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
  var filter = staffConfirmDemo() ? "toutes" : "confirmer"; // demo rows are Confirmée
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
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  function readPatches() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch (e) { return {}; }
  }
  function examples() {
    return window.AdminSample ? window.AdminSample.requests() : [];
  }
  function staffConfirmDemo() {
    try {
      var host = location.hostname;
      var preview = host === "localhost" || host === "127.0.0.1" || /\.vercel\.app$/.test(host);
      return preview && new URLSearchParams(location.search).get("demo") === "confirm-staff";
    } catch (e) { return false; }
  }
  function staffConfirmText(item) {
    var list = item.staff_confirm || [];
    if (!list.length) return "";
    return list.map(function (row) {
      return (row.name || "") + (row.confirmed ? " ✓" : " en attente");
    }).filter(Boolean).join(" · ");
  }
  // French sentence case for service labels: « restauration » → « Restauration »,
  // « location voiture » → « Location voiture ». Only the first letter changes.
  function serviceLabel(value) {
    var text = String(value || "").trim();
    return text ? text.charAt(0).toLocaleUpperCase("fr-FR") + text.slice(1) : text;
  }
  function demoStaffItems() {
    var now = new Date();
    function row(id, confirm) {
      return {
        id: id,
        kind: "breakfast",
        label: serviceLabel("restauration"),
        adults: 2,
        children: 0,
        extra: "Petit-déjeuner",
        guest: "Démo",
        stay: "Démo",
        stay_id: "DEMO-STAFF",
        staff: "Fouzia",
        status: "Confirmée",
        when: now,
        created: Date.now(),
        price: "",
        dh: "",
        token: "",
        offert: false,
        staff_confirm: confirm
      };
    }
    return [
      row("demo-pending", [{ name: "Fouzia", confirmed: true }, { name: "Khalid", confirmed: false }]),
      row("demo-done", [{ name: "Fouzia", confirmed: true }, { name: "Khalid", confirmed: true }])
    ];
  }
  function allItems() {
    if (staffConfirmDemo()) return demoStaffItems();

    var patches = readPatches();
    // Real feed (action=demandes) in every mode; a test session gets the
    // test rows from the script. Samples only on the explicit demo URL.
    var source = remoteItems || [];
    return source.map(function (item) {
      return Object.assign({}, item, patches[item.id] || {});
    });
  }
  function activeStayIds() {
    return remoteCurrentIds || [];
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
  // Shared normalizer (AdminShell.demandeFromApi, js/vz-fields.js).
  function fromApi(raw) {
    var item = shell.demandeFromApi(raw);
    item.price = raw.total === "" || raw.total == null ? "" : euroText(raw.total);
    item.dh = item.price && raw.total ? (Math.round(Number(raw.total)) + "\u00A0DH") : "";
    return item;
  }
  function dayKey(item) { return isoDay(item.when); }
  function isFutureDay(item) { return dayKey(item) >= isoDay(today()); }
  function isToday(item) { return dayKey(item) === isoDay(today()); }
  function toConfirm(items) {
    return items.filter(function (item) { return item.status === "Envoyée" && isFutureDay(item); });
  }
  function paxOf(item) {
    var bits = [];
    if (item.adults) bits.push(item.adults + " ad.");
    if (item.children) bits.push(item.children + " enf.");
    return bits;
  }
  // Full title, used in the WhatsApp relance text.
  function titleOf(item) {
    var bits = paxOf(item);
    if (item.extra) bits.push(item.extra);
    return bits.length ? item.label + " · " + bits.join(" · ") : item.label;
  }
  // Row title: service + sous-type only, so it fits on one line at iPhone width.
  // Guests count moves to the subtitle (metaOf).
  function rowTitleOf(item) {
    return item.extra ? item.label + " · " + item.extra : item.label;
  }
  // Never a made-up 00:00: without a time, the day only.
  function whenLabel(item) {
    var date = item.when;
    var day = isToday(item) ? "aujourd’hui" : (date.getDate() + "\u00A0" + MONTHS[date.getMonth()]);
    return item.hasTime === false ? day : day + " · " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }
  // « Confirmée le 25 nov. à 14:32 » (date_confirmation).
  function confirmedLine(item) {
    return item.status === "Confirmée" && window.VZFields ? window.VZFields.confirmedText(item.date_confirmation) : "";
  }
  function since(item) {
    var min = Math.round((Date.now() - item.created) / 60000);
    if (min < 60) return "depuis " + Math.max(min, 1) + " min";
    var hours = Math.round(min / 60);
    if (hours < 48) return "depuis " + hours + "\u00A0h";
    return "depuis " + Math.round(hours / 24) + "\u00A0j";
  }
  function metaOf(item) {
    var text = [item.guest].concat(paxOf(item)).filter(Boolean).join(" · ") + " · " + whenLabel(item);
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
    if (!item.id || !item.token) return "https://villazenomarrakech.com/c?r=" + encodeURIComponent(item.id || "") + "&k=" + encodeURIComponent(item.token || "");
    return "https://villazenomarrakech.com/c/" + encodeURIComponent(item.id) + "-" + encodeURIComponent(item.token);
  }
  function relanceHref(item) {
    var number = String(STAFF_WA[item.staff] || "").replace(/\D/g, "");
    if (!number) return "";
    var text = "Bonjour " + item.staff + ", un rappel Villa Zen’O :\n" + titleOf(item) + "\n" + item.guest + " · " + whenLabel(item) + "\n\nConfirmer :\n" + confirmUrl(item);
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  }
  /* Status / Offert change: written through the shared client and WAITED
     for. The row shows the new state only after ok:true; a failure puts
     the previous state back and shows the error with « Réessayer ». */
  function savePatch(item, previous, root) {
    item.saving = true;
    if (root) paint(root);
    shell.api.post({ action: "set-demande", id: item.id, statut: item.status, offert: !!item.offert }).then(function (result) {
      item.saving = false;
      var note = root ? root.querySelector("[data-req-error]") : null;
      if (!result.ok) {
        item.status = previous.status;
        item.offert = previous.offert;
        if (root) paint(root);
        note = root ? root.querySelector("[data-req-error]") : null;
        if (note) shell.showError(note, result, function () {
          var again = { status: item.status, offert: item.offert };
          item.status = previous.next.status;
          item.offert = previous.next.offert;
          savePatch(item, again, root);
        }, "save");
        return;
      }
      if (item.status === "Confirmée" && !item.date_confirmation && window.VZFields) {
        var now = new Date();
        item.date_confirmation = window.VZFields.iso(now) + " " + window.VZFields.clock(now);
      }
      var patches = readPatches();
      patches[item.id] = { status: item.status, offert: !!item.offert };
      try { sessionStorage.setItem(STORE, JSON.stringify(patches)); } catch (e) {}
      var count = toConfirm(allItems()).length;
      try { sessionStorage.setItem("vz.admin.confirmer", String(count)); } catch (e2) {}
      var link = document.querySelector("[data-nav='demandes']");
      if (link) link.classList.toggle("has-dot", count > 0);
      if (shell.invalidate) shell.invalidate("demandes");
      if (root) paint(root);
    });
  }
  function rowHtml(item) {
    var open = openId === item.id;
    var price = item.price
      ? '<span class="req-price">' + esc(item.price) + (item.dh ? '<span class="req-dh"> · ' + esc(item.dh) + '</span>' : '') + '</span>'
      : '<span class="req-price">\u00A0</span>';
    var confirmText = staffConfirmText(item);
    var staff = confirmText
      ? '<span class="req-staff req-staff-confirm">' + esc(confirmText) + '</span>'
      : '<span class="req-staff">' + esc(item.staff) + '</span>';
    var href = relanceHref(item);
    var relance = href
      ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">Relancer</a>'
      : '<button type="button" data-relance="' + esc(item.id) + '">Relancer</button>';
    var actions = open
      ? '<div class="req-actions"><button type="button" data-statut="' + esc(item.id) + '">Changer statut</button>' + relance + '<button type="button" data-offert="' + esc(item.id) + '"' + (item.offert ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + '>Offert</button></div>'
      : "";
    return '<div data-id="' + esc(item.id) + '"><button type="button" class="req-row" data-open="' + esc(item.id) + '" aria-expanded="' + (open ? "true" : "false") + '">'
      + icon(item.kind)
      + '<span class="req-title">' + esc(rowTitleOf(item)) + '</span>'
      + '<span class="req-meta">' + esc(metaOf(item)) + '</span>'
      + (confirmedLine(item) ? '<span class="req-meta req-confirmed">' + esc(confirmedLine(item)) + '</span>' : '')
      + '<span class="req-foot">' + price + staff + '</span>'
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
        if (item && !item.saving) {
          var before = { status: item.status, offert: item.offert };
          item.status = set.getAttribute("data-set");
          before.next = { status: item.status, offert: item.offert };
          savePatch(item, before, root);
        }
        closeSheet(root);
        paint(root);
        return;
      }
      var offert = event.target.closest("[data-offert]");
      if (offert) {
        var target = findItem(offert.getAttribute("data-offert"));
        if (target && !target.saving) {
          var was = { status: target.status, offert: target.offert };
          target.offert = !target.offert;
          was.next = { status: target.status, offert: target.offert };
          savePatch(target, was, root);
        }
        return;
      }
      if (event.target.closest("[data-sheet-close]") || event.target.hasAttribute("data-sheet-back")) closeSheet(root);
    });
    if (staffConfirmDemo()) { paint(root); return; }
    load(root);
  }
  // Demandes + stays (current stays), both awaited; an error is shown with « Réessayer ».
  function load(root) {
    var note = root.querySelector("[data-req-loading]");
    if (!note) {
      note = document.createElement("p");
      note.className = "empty";
      note.setAttribute("data-req-loading", "");
      root.insertBefore(note, root.firstChild);
    }
    note.hidden = false;
    note.textContent = "Chargement des demandes…";
    Promise.all([shell.api.get({ action: "demandes" }), shell.api.get({ action: "stays" })]).then(function (pair) {
      note.hidden = true;
      if (!pair[0].ok) {
        shell.loadError(pair[0], function () { load(root); });
        paint(root);
        return;
      }
      shell.loadError(null);
      remoteItems = ((pair[0].data && pair[0].data.items) || []).map(fromApi);
      var todayIso = isoDay(today());
      remoteCurrentIds = ((pair[1].ok && pair[1].data.stays) || []).filter(function (stay) {
        return stay.arrival && stay.departure && stay.arrival <= todayIso && todayIso < stay.departure;
      }).map(function (stay) { return stay.id; });
      paint(root);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
