/* Villa Zen'O: the ONE Apps Script client (guest pages, admin, /c/).
   Every call is awaited and always resolves (never rejects) with:
     { ok: true, data }
     { ok: false, kind, error }  kind: session | invalid_link | expired | busy | server | network | timeout
   - GET (reads): timeout + automatic retries with backoff (idempotent).
   - POST (writes): text/plain body (no CORS preflight), one try, timeout;
     the answer is read (no "no-cors" fire-and-forget).
   - Nothing is swallowed: callers show VZApi.message(result) and a
     « Réessayer » button (VZApi.showError).
   Tests mock the /exec URL at the network boundary (Playwright route). */
(function (root) {
  "use strict";

  /* /exec URL per environment (2026-11-27).
     - Production (www / villazenomarrakech.com on GitHub Pages,
       villazenomarrakech.vercel.app), localhost and anything unknown: PROD_URL,
       exactly as before, decided at once (no extra request).
     - A Vercel PREVIEW (*.vercel.app, not the production alias): asks
       /api/vz-env once; the Vercel env variable VZ_EXEC_URL (Preview only)
       points it to the staging /exec. No answer or no variable: PROD_URL.
     Every call waits for that choice (urlReady), so a preview never sends
     anything to production by mistake once VZ_EXEC_URL is set. */
  var PROD_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";
  var PROD_HOSTS = { "www.villazenomarrakech.com": 1, "villazenomarrakech.com": 1, "villazenomarrakech.vercel.app": 1 };
  var EXEC_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/;
  var URL = PROD_URL;
  function isPreviewHost(host) {
    host = String(host || "").toLowerCase();
    return !PROD_HOSTS[host] && /\.vercel\.app$/.test(host);
  }
  var urlReady = (function () {
    var host = "";
    try { host = root.location.hostname; } catch (e) {}
    if (!isPreviewHost(host) || !root.fetch) return Promise.resolve(PROD_URL);
    var done = false;
    return new Promise(function (resolve) {
      var timer = root.setTimeout(function () { if (!done) { done = true; resolve(PROD_URL); } }, 5000);
      root.fetch("/api/vz-env", { cache: "no-store" }).then(function (res) { return res.json(); }).then(function (data) {
        var url = data && EXEC_RE.test(String(data.execUrl || "")) ? String(data.execUrl) : PROD_URL;
        if (!done) { done = true; root.clearTimeout(timer); resolve(url); }
      }, function () {
        if (!done) { done = true; root.clearTimeout(timer); resolve(PROD_URL); }
      });
    }).then(function (url) { api.URL = url; api.env = url === PROD_URL ? "production" : "staging"; return url; });
  })();
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
      return urlReady.then(function (base) {
        url = base + "?" + query(params);
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
    return urlReady.then(function (base) {
      return once(base, {
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

  var api = { URL: URL, PROD_URL: PROD_URL, env: "production", urlReady: urlReady, isPreviewHost: isPreviewHost, get: get, post: post, message: message, showError: showError, classify: classify };
  root.VZApi = api;
})(window);
