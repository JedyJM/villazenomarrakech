/* Admin Demandes. French. TEST_MODE uses Camille’s sample requests. */
(function () {
  "use strict";

  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return ""; } };
  var STORE = "vz.admin.demandes";
  /* Relancer opens WhatsApp. It does not send the message. */
  var STAFF_WA = {
    Hicham: "212661775422",
    Fouzia: "212767202011",
    Nadera: "212639474843",
    Khalid: "212630415956",
    "Massages & soins": "212661614469"
  };
  var ICONS = {
    breakfast: '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"/><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"/><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"/><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"/><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"/>',
    dinner: '<path d="M16.5 4.8A7.2 7.2 0 1 0 16.5 19 5.4 5.4 0 0 1 16.5 4.8z"/>',
    menage: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
    quad: '<path d="M2.75 17a3.25 3.25 0 1 0 6.5 0a3.25 3.25 0 1 0-6.5 0m12 0a3.25 3.25 0 1 0 6.5 0a3.25 3.25 0 1 0-6.5 0M2.5 12.5c1-1.25 2.25-2 4-2h2l1 2h5l1-2h2c1.75 0 3 .75 4 2m-13-4h4m3 2l1-4H19"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    flower: '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>'
  };
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var STATUSES = ["Envoyée", "Confirmée", "Terminée", "Annulée"];
  var openId = "";
  var filter = "confirmer";
  var remoteItems = null;
  var remoteCurrentIds = null;
  try {
    var asked = new URLSearchParams(window.location.search).get("open");
    if (asked) openId = asked;
  } catch (e) {}

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDay(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function today() {
    if (shell.TEST_MODE) return new Date(2026, 11, 16);
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  function readPatches() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch (e) { return {}; }
  }
  function examples() {
    return window.AdminSample ? window.AdminSample.requests() : [];
  }
  function allItems() {
    var patches = readPatches();
    var source = shell.TEST_MODE ? examples() : (remoteItems || []);
    return source.map(function (item) {
      return Object.assign({}, item, patches[item.id] || {});
    });
  }
  function activeStayIds() {
    if (!shell.TEST_MODE) return remoteCurrentIds || [];
    var book = window.AdminSample && window.AdminSample.stays && window.AdminSample.stays();
    return book && book.current ? [book.current.id] : [];
  }
  function euroText(dh) {
    var eur = Math.round(Number(dh)) / 10;
    if (!isFinite(eur) || !eur) return "";
    var neg = eur < 0;
    eur = Math.abs(eur);
    var whole = String(Math.floor(eur));
    var frac = Math.round((eur - Math.floor(eur)) * 100);
    return (neg ? "−" : "") + whole + (frac ? "," + (frac < 10 ? "0" : "") + frac : "") + "\u00A0€";
  }
  function fromApi(raw) {
    var date = String(raw.date || "1970-01-01").split("-");
    var time = String(raw.time || "0:0").split(":");
    var when = new Date(Number(date[0]), (Number(date[1]) || 1) - 1, Number(date[2]) || 1, Number(time[0]) || 0, Number(time[1]) || 0);
    var service = String(raw.service || "Demande");
    var key = service.toLowerCase();
    var kind = "menage";
    if (key.indexOf("petit") >= 0) kind = "breakfast";
    else if (key.indexOf("ner") >= 0 || key.indexOf("dinner") >= 0) kind = "dinner";
    else if (key.indexOf("nage") >= 0) kind = "menage";
    else if (key.indexOf("quad") >= 0) kind = "quad";
    else if (key.indexOf("transfert") >= 0 || key.indexOf("voiture") >= 0) kind = "car";
    else if (key.indexOf("massage") >= 0) kind = "flower";
    var created = Date.parse(raw.created);
    var price = raw.total === "" || raw.total == null ? "" : euroText(raw.total);
    return {
      id: String(raw.id || ""),
      kind: kind,
      label: service,
      adults: Number(raw.adults) || 0,
      children: Number(raw.children) || 0,
      extra: raw.trip || raw.sous_type || "",
      guest: raw.guest || "",
      stay: raw.guest || "",
      stay_id: String(raw.stay || ""),
      staff: raw.staff || "",
      status: raw.status || "Envoyée",
      when: when,
      created: isFinite(created) ? created : Date.now(),
      price: price,
      dh: price && raw.total ? (Math.round(Number(raw.total)) + "\u00A0DH") : "",
      token: raw.token || "",
      offert: !!raw.offert
    };
  }
  function dayKey(item) { return isoDay(item.when); }
  function isFutureDay(item) { return dayKey(item) >= isoDay(today()); }
  function isToday(item) { return dayKey(item) === isoDay(today()); }
  function toConfirm(items) {
    return items.filter(function (item) { return item.status === "Envoyée" && isFutureDay(item); });
  }
  function titleOf(item) {
    var bits = [];
    if (item.adults) bits.push(item.adults + " ad.");
    if (item.children) bits.push(item.children + " enf.");
    if (item.extra) bits.push(item.extra);
    return bits.length ? item.label + " · " + bits.join(" · ") : item.label;
  }
  function whenLabel(item) {
    var date = item.when;
    var day = isToday(item) ? "aujourd’hui" : (date.getDate() + "\u00A0" + MONTHS[date.getMonth()]);
    return day + " · " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }
  function since(item) {
    var min = Math.round((Date.now() - item.created) / 60000);
    if (min < 60) return "depuis " + Math.max(min, 1) + " min";
    var hours = Math.round(min / 60);
    if (hours < 48) return "depuis " + hours + "\u00A0h";
    return "depuis " + Math.round(hours / 24) + "\u00A0j";
  }
  function metaOf(item) {
    var text = item.guest + " · " + whenLabel(item);
    if (item.status === "Envoyée") text += " · " + since(item);
    return text;
  }
  function chipClass(status) {
    if (status === "Confirmée") return "status-confirmee";
    if (status === "Terminée") return "status-terminee";
    if (status === "Annulée") return "status-annulee";
    return "status-envoyee";
  }
  function icon(kind) {
    return '<span class="req-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[kind] || ICONS.menage) + "</svg></span>";
  }
  function confirmUrl(item) {
    return "https://villazenomarrakech.com/c?r=" + encodeURIComponent(item.id) + "&k=" + encodeURIComponent(item.token);
  }
  function relanceHref(item) {
    var number = String(STAFF_WA[item.staff] || "").replace(/\D/g, "");
    if (!number) return "";
    var text = "Bonjour " + item.staff + ", un rappel Villa Zen’O :\n" + titleOf(item) + "\n" + item.guest + " · " + whenLabel(item) + "\n\nConfirmer :\n" + confirmUrl(item);
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  }
  function savePatch(item) {
    var patches = readPatches();
    patches[item.id] = { status: item.status, offert: !!item.offert };
    try { sessionStorage.setItem(STORE, JSON.stringify(patches)); } catch (e) {}
    var count = toConfirm(allItems()).length;
    try { sessionStorage.setItem("vz.admin.confirmer", String(count)); } catch (e2) {}
    var link = document.querySelector("[data-nav='demandes']");
    if (link) link.classList.toggle("has-dot", count > 0);
    if (!shell.SCRIPT_URL || !window.fetch) return;
    window.fetch(shell.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "set-demande", test: "1", id: item.id, statut: item.status, offert: !!item.offert })
    }).catch(function () {});
  }
  function rowHtml(item) {
    var open = openId === item.id;
    var price = item.price
      ? '<span class="req-price">' + esc(item.price) + (item.dh ? '<span class="req-dh"> · ' + esc(item.dh) + '</span>' : '') + '</span>'
      : '<span class="req-price">\u00A0</span>';
    var href = relanceHref(item);
    var relance = href
      ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">Relancer</a>'
      : '<button type="button" data-relance="' + esc(item.id) + '">Relancer</button>';
    var actions = open
      ? '<div class="req-actions"><button type="button" data-statut="' + esc(item.id) + '">Changer statut</button>' + relance + '<button type="button" data-offert="' + esc(item.id) + '"' + (item.offert ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + '>Offert</button></div>'
      : "";
    return '<div data-id="' + esc(item.id) + '"><button type="button" class="req-row" data-open="' + esc(item.id) + '" aria-expanded="' + (open ? "true" : "false") + '">'
      + icon(item.kind)
      + '<span class="req-title">' + esc(titleOf(item)) + '</span>'
      + '<span class="req-staff">' + esc(item.staff) + '</span>'
      + '<span class="req-meta">' + esc(metaOf(item)) + '</span>'
      + price
      + '<span class="req-chip status-chip ' + chipClass(item.status) + '">' + esc(item.status) + '</span>'
      + '</button>' + actions + '</div>';
  }
  function section(kicker, groups) {
    return '<section class="req-block"><p class="kicker">' + esc(kicker) + '</p>'
      + groups.map(function (group) {
        return (group.name ? '<p class="req-group">' + esc(group.name) + '</p>' : '')
          + '<div class="card">' + group.items.map(rowHtml).join("") + '</div>';
      }).join("") + '</section>';
  }
  function paint(root) {
    var items = allItems();
    var waiting = toConfirm(items);
    var badge = root.querySelector("[data-count]");
    if (badge) badge.textContent = String(waiting.length);
    root.querySelectorAll("[data-filter]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-filter") === filter ? "true" : "false");
    });
    var list = root.querySelector("[data-list]");
    var html = "";
    if (filter === "confirmer") {
      html = waiting.length ? '<div class="card">' + waiting.map(rowHtml).join("") + '</div>' : '<p class="empty">Aucune demande à confirmer.</p>';
    } else if (filter === "aujourd") {
      var todayItems = items.filter(isToday).sort(function (a, b) { return b.when - a.when; });
      var currentIds = activeStayIds();
      var earlier = items.filter(function (item) {
        return dayKey(item) < isoDay(today()) && currentIds.indexOf(item.stay_id) >= 0;
      });
      if (todayItems.length) html += '<div class="card">' + todayItems.map(rowHtml).join("") + '</div>';
      if (earlier.length) {
        var byStay = {};
        earlier.sort(function (a, b) { return a.when - b.when; }).forEach(function (item) {
          if (!byStay[item.stay]) byStay[item.stay] = [];
          byStay[item.stay].push(item);
        });
        html += section("Plus tôt dans le séjour", Object.keys(byStay).map(function (name) {
          return { name: name, items: byStay[name] };
        }));
      }
      if (!html) html = '<p class="empty">Rien pour aujourd’hui.</p>';
    } else {
      var groups = {};
      items.slice().sort(function (a, b) { return b.when - a.when; }).forEach(function (item) {
        var key = dayKey(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      html = Object.keys(groups).sort().reverse().map(function (key) {
        var date = groups[key][0].when;
        var label = isoDay(date) === isoDay(today())
          ? "Aujourd’hui · " + date.getDate() + " " + MONTHS[date.getMonth()]
          : date.getDate() + " " + MONTHS[date.getMonth()];
        return section(label, [{ name: "", items: groups[key] }]);
      }).join("");
    }
    list.innerHTML = html;
    try { sessionStorage.setItem("vz.admin.confirmer", String(waiting.length)); } catch (e) {}
  }
  function findItem(id) {
    var found = null;
    allItems().forEach(function (item) { if (item.id === id) found = item; });
    return found;
  }
  function openSheet(root, item) {
    var sheet = root.querySelector("[data-sheet]");
    var back = root.querySelector("[data-sheet-back]");
    var box = root.querySelector("[data-statut-list]");
    box.innerHTML = STATUSES.map(function (status) {
      var current = status === item.status ? " is-current" : "";
      return '<button type="button" class="statut-choice' + current + '" data-set="' + esc(status) + '">' + esc(status) + '</button>';
    }).join("");
    sheet.hidden = false;
    back.hidden = false;
    sheet.setAttribute("data-for", item.id);
  }
  function closeSheet(root) {
    root.querySelector("[data-sheet]").hidden = true;
    root.querySelector("[data-sheet-back]").hidden = true;
  }
  function boot() {
    var root = document.querySelector("[data-demandes]");
    if (!root || document.body.classList.contains("is-locked")) return;
    root.addEventListener("click", function (event) {
      var open = event.target.closest("[data-open]");
      if (open && !event.target.closest(".req-actions")) {
        openId = openId === open.getAttribute("data-open") ? "" : open.getAttribute("data-open");
        paint(root);
        return;
      }
      var filterBtn = event.target.closest("[data-filter]");
      if (filterBtn) {
        filter = filterBtn.getAttribute("data-filter");
        openId = "";
        closeSheet(root);
        paint(root);
        return;
      }
      var statut = event.target.closest("[data-statut]");
      if (statut) { openSheet(root, findItem(statut.getAttribute("data-statut"))); return; }
      var set = event.target.closest("[data-set]");
      if (set) {
        var item = findItem(root.querySelector("[data-sheet]").getAttribute("data-for"));
        if (item) { item.status = set.getAttribute("data-set"); savePatch(item); }
        closeSheet(root);
        paint(root);
        return;
      }
      var offert = event.target.closest("[data-offert]");
      if (offert) {
        var target = findItem(offert.getAttribute("data-offert"));
        if (target) { target.offert = !target.offert; savePatch(target); paint(root); }
        return;
      }
      if (event.target.closest("[data-sheet-close]") || event.target.hasAttribute("data-sheet-back")) closeSheet(root);
    });
    if (shell.TEST_MODE || !shell.SCRIPT_URL || !window.fetch) {
      paint(root);
      return;
    }
    var token = encodeURIComponent(shell.session());
    var base = shell.SCRIPT_URL + "?token=" + token;
    Promise.all([
      window.fetch(base + "&action=demandes").then(function (res) { return res.json(); }),
      window.fetch(base + "&action=stays").then(function (res) { return res.json(); })
    ]).then(function (pair) {
      remoteItems = ((pair[0] && pair[0].items) || []).map(fromApi);
      var todayIso = isoDay(today());
      remoteCurrentIds = ((pair[1] && pair[1].stays) || []).filter(function (stay) {
        return stay.arrival && stay.departure && stay.arrival <= todayIso && todayIso < stay.departure;
      }).map(function (stay) { return stay.id; });
      paint(root);
    }).catch(function () { paint(root); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
