/* Villa Zen'O: the ONE Apps Script client (guest pages, admin, /c/).
   Every call is awaited and always resolves (never rejects) with:
     { ok: true, data }
     { ok: false, kind, error }  kind: session | invalid_link | expired | busy | server | network | timeout | unavailable
   - GET (reads): timeout + automatic retries with backoff (idempotent).
   - POST (writes): text/plain body (no CORS preflight), one try, timeout;
     the answer is read (no "no-cors" fire-and-forget).
   - Nothing is swallowed: callers show VZApi.message(result) and a
     « Réessayer » button (VZApi.showError).
   Tests mock the /exec URL at the network boundary (Playwright route). */
(function (root) {
  "use strict";

  /* /exec URL per environment (2026-11-27, fixed 2026-11-28).
     - Production (www / villazenomarrakech.com on GitHub Pages,
       villazenomarrakech.vercel.app), localhost and anything unknown: PROD_URL,
       exactly as before, decided at once (no extra request).
     - A Vercel PREVIEW (*.vercel.app, not the production alias) NEVER uses
       PROD_URL. It asks /api/vz-env; the Vercel env variable VZ_EXEC_URL
       (Preview only) gives the staging /exec. A slow (> 4 s), failed or
       non-JSON answer is asked again (3 tries in all, ~13 s at most). Still
       nothing, or no valid execUrl: no URL. Then get / post send NOTHING to
       any /exec and resolve { ok: false, kind: "unavailable" }, shown as
       « Un contretemps de notre côté… » (message). The next call (e.g. the
       « Réessayer » button) asks /api/vz-env again.
     urlReady resolves the /exec URL, or "" on a preview without one. */
  var PROD_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";
  var PROD_HOSTS = { "www.villazenomarrakech.com": 1, "villazenomarrakech.com": 1, "villazenomarrakech.vercel.app": 1 };
  var EXEC_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/;
  var ENV_TRIES = 3;
  var ENV_TIMEOUT = 4000;
  var ENV_BACKOFF = 500;
  function isPreviewHost(host) {
    host = String(host || "").toLowerCase();
    return !PROD_HOSTS[host] && /\.vercel\.app$/.test(host);
  }
  var pageHost = "";
  try { pageHost = root.location.hostname; } catch (e) {}
  var onPreview = isPreviewHost(pageHost);
  var URL = onPreview ? "" : PROD_URL;

  // One /api/vz-env exchange: the staging /exec, or "" (slow, failed, not JSON, no variable).
  function askEnv() {
    if (!root.fetch) return Promise.resolve("");
    return new Promise(function (resolve) {
      var done = false;
      var timer = root.setTimeout(function () { if (!done) { done = true; resolve(""); } }, ENV_TIMEOUT);
      function end(url) { if (!done) { done = true; root.clearTimeout(timer); resolve(url); } }
      try {
        root.fetch("/api/vz-env", { cache: "no-store" }).then(function (res) { return res.json(); }).then(function (data) {
          end(data && EXEC_RE.test(String(data.execUrl || "")) ? String(data.execUrl) : "");
        }, function () { end(""); });
      } catch (e) { end(""); }
    });
  }
  function lookupEnv() {
    function attempt(n) {
      return askEnv().then(function (url) {
        if (url || n + 1 >= ENV_TRIES) return url;
        return wait(ENV_BACKOFF * (n + 1)).then(function () { return attempt(n + 1); });
      });
    }
    return attempt(0).then(function (url) {
      if (url) api.urlReady = Promise.resolve(url);
      api.URL = url;
      api.env = url ? "staging" : "unavailable";
      return url;
    });
  }
  /* The URL for the next call (base). On a preview, every call joins the
     running lookup; once a lookup has failed, the next call starts a new
     one (a call already waiting for a lookup takes its answer: no double
     wait). */
  var lookup = null;
  var looking = false;
  function startLookup() {
    looking = true;
    lookup = lookupEnv().then(function (url) { looking = false; return url; });
    return lookup;
  }
  var urlReady = onPreview ? startLookup() : Promise.resolve(PROD_URL);
  function base() {
    if (!onPreview) return urlReady;
    if (looking) return lookup;
    return lookup.then(function (url) { return url || (looking ? lookup : startLookup()); });
  }
  var UNAVAILABLE = { ok: false, kind: "unavailable", error: "no_exec_url" };
  var SESSION_ERRORS = { forbidden: 1, invalid_token: 1, unauthorized: 1 };

  function wait(ms) { return new Promise(function (resolve) { root.setTimeout(resolve, ms); }); }

  function classify(data) {
    if (data && data.ok === true) return { ok: true, data: data };
    if (Array.isArray(data)) return { ok: true, data: { ok: true, items: data } };
    var error = String((data && data.error) || "");
    if (SESSION_ERRORS[error]) return { ok: false, kind: "session", error: error };
    if (error === "invalid_link") return { ok: false, kind: "invalid_link", error: error };
    if (error === "expired") return { ok: false, kind: "expired", error: error };
    if (error === "busy" || error === "rate_limited") return { ok: false, kind: "busy", error: error };
    return { ok: false, kind: "server", error: error || "refused", data: data };
  }

  // One HTTP exchange with a timeout. Resolves a result object.
  function once(url, init, timeoutMs) {
    if (!root.fetch) return Promise.resolve({ ok: false, kind: "network", error: "no_fetch" });
    var controller = root.AbortController ? new root.AbortController() : null;
    var timer = 0;
    var timedOut = false;
    var timeout = new Promise(function (resolve) {
      timer = root.setTimeout(function () {
        timedOut = true;
        if (controller) controller.abort();
        resolve({ ok: false, kind: "timeout", error: "timeout" });
      }, timeoutMs);
    });
    var options = Object.assign({ redirect: "follow", cache: "no-store" }, init || {});
    if (controller) options.signal = controller.signal;
    var request;
    try {
      request = root.fetch(url, options).then(function (res) {
        return res.text().then(function (text) {
          var data;
          try { data = JSON.parse(text); } catch (e) {
            return { ok: false, kind: res.ok ? "server" : "network", error: res.ok ? "not_json" : "http_" + res.status };
          }
          return classify(data);
        });
      }, function () {
        return { ok: false, kind: timedOut ? "timeout" : "network", error: timedOut ? "timeout" : "network" };
      });
    } catch (e) {
      request = Promise.resolve({ ok: false, kind: "network", error: "network" });
    }
    return Promise.race([request, timeout]).then(function (result) {
      root.clearTimeout(timer);
      return result;
    });
  }

  function query(params) {
    return Object.keys(params || {}).filter(function (key) {
      return params[key] !== undefined && params[key] !== null;
    }).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]));
    }).join("&");
  }

  /* Read. opts: timeout (ms, default 20000), retries (default 2),
     backoff (ms, default 800), retryTimeout (default true). Retries only
     network / timeout / busy / non-JSON answers, never a refusal (session,
     invalid_link, expired). retryTimeout false: a timed-out read is not
     sent again (the script is still running it; a new copy only queues
     behind it). */
  function get(params, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeout || 20000;
    var retries = opts.retries == null ? 2 : opts.retries;
    var backoff = opts.backoff == null ? 800 : opts.backoff;
    var url = "";
    function attempt(n) {
      return base().then(function (exec) {
        if (!exec) return Object.assign({}, UNAVAILABLE);
        url = exec + "?" + query(params);
        return once(url, { method: "GET" }, timeoutMs);
      }).then(function (result) {
        var retryable = !result.ok && (result.kind === "network" || (result.kind === "timeout" && opts.retryTimeout !== false) || result.kind === "busy" || result.error === "not_json");
        if (retryable && n < retries) return wait(backoff * (n + 1)).then(function () { return attempt(n + 1); });
        return result;
      });
    }
    return attempt(0);
  }

  // Write. One try (the caller offers « Réessayer »; writes carry their own id).
  function post(body, opts) {
    opts = opts || {};
    return base().then(function (exec) {
      if (!exec) return Object.assign({}, UNAVAILABLE);
      return once(exec, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body || {})
      }, opts.timeout || 25000);
    });
  }

  function isEn() {
    try { return (root.document.documentElement.lang || "fr").slice(0, 2) === "en"; } catch (e) { return false; }
  }

  // Short message for a failed call (FR, EN on English pages).
  function message(result, context) {
    var en = isEn();
    var kind = result && result.kind;
    if (kind === "session") return en ? "Session expired — sign in again." : "Session expirée — reconnectez-vous.";
    if (kind === "invalid_link") return en ? "This link is no longer valid. Ask the villa for a new link." : "Ce lien n’est plus valable. Demandez un nouveau lien à la villa.";
    if (kind === "expired") return en ? "Your stay link has expired." : "Le lien de votre séjour a expiré.";
    // « Formule A »: no /exec URL on a preview (/api/vz-env did not answer).
    if (kind === "unavailable") return en ? "Something went wrong on our side. Try again in a moment, or write to Mehdi." : "Un contretemps de notre côté. Réessayez dans un instant, ou écrivez à Mehdi.";
    if (kind === "busy") return en ? "The villa server is busy. Try again in a moment." : "Le serveur de la villa est occupé. Réessayez dans un instant.";
    if (kind === "server") return context === "save"
      ? (en ? "The server refused the request. Try again or tell the villa." : "Le serveur a refusé l’enregistrement. Réessayez ou prévenez Jedy.")
      : (en ? "The server could not answer. Try again." : "Le serveur n’a pas pu répondre. Réessayez.");
    return en ? "No answer. Check your connection, then try again." : "Pas de réponse. Vérifiez le réseau, puis réessayez.";
  }

  /* Fills node (role="alert") with the message and a « Réessayer » button
     calling retry(). Returns the node. A session failure adds a sign-in
     link (admin). */
  function showError(node, result, retry, opts) {
    if (!node) return node;
    opts = opts || {};
    var doc = root.document;
    node.textContent = "";
    node.hidden = false;
    node.setAttribute("data-api-error", (result && result.kind) || "network");
    var text = doc.createElement("span");
    text.textContent = opts.text || message(result, opts.context);
    node.appendChild(text);
    if (result && result.kind === "session" && opts.signIn) {
      node.appendChild(doc.createTextNode(" "));
      var link = doc.createElement("a");
      link.href = opts.signIn;
      link.textContent = isEn() ? "Sign in" : "Se reconnecter";
      if (opts.onSignIn) link.addEventListener("click", opts.onSignIn);
      node.appendChild(link);
    }
    if (retry && !(result && (result.kind === "invalid_link" || result.kind === "expired" || result.kind === "session"))) {
      var button = doc.createElement("button");
      button.type = "button";
      button.className = "api-retry";
      button.setAttribute("data-retry", "");
      button.textContent = isEn() ? "Try again" : "Réessayer";
      button.addEventListener("click", function () {
        node.hidden = true;
        node.textContent = "";
        retry();
      });
      node.appendChild(button);
    }
    return node;
  }

  var api = { URL: URL, PROD_URL: PROD_URL, env: onPreview ? "pending" : "production", urlReady: urlReady, isPreviewHost: isPreviewHost, get: get, post: post, message: message, showError: showError, classify: classify };
  root.VZApi = api;
})(window);
