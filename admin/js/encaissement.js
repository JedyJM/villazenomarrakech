/* Encaissement d’un séjour. Français. Le mode test lit les séjours d’exemple. */
(function () {
  "use strict";

  var calc = window.AdminCalc;
  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return "test"; } };
  var PAY_KEY = "vz.admin.encaissement";
  var MODES = [["eur", "Espèces €"], ["dh", "Espèces DH"], ["paypal", "PayPal"]];
  var ICONS = {
    pool: '<path d="M19 5a2 2 0 0 0-2 2v11"/><path d="M9 5a2 2 0 0 0-2 2v11"/><path d="M7 9h10"/><path d="M7 13h10"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    breakfast: '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"/><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"/><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"/><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"/><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"/>',
    dinner: '<path d="M16.5 4.8A7.2 7.2 0 1 0 16.5 19 5.4 5.4 0 0 1 16.5 4.8z"/>',
    tax: '<path d="M6 3.5h12v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2v-17z"/><path d="M9 8h6M9 12h6M9 16h4"/>'
  };
  var state = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function readPay() {
    try { return JSON.parse(localStorage.getItem(PAY_KEY) || "{}"); } catch (e) { return {}; }
  }
  function euros(cents) {
    var n = Math.round(Number(cents) || 0);
    if (n % 100 === 0) {
      var whole = String(Math.abs(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
      return (n < 0 ? "−" : "") + whole + "\u00A0€";
    }
    return calc.money(n);
  }
  function paypalCents(due) {
    return Math.round(due * 1.044) + 35;
  }
  function modeLabel(key) {
    var label = "Espèces €";
    MODES.forEach(function (mode) { if (mode[0] === key) label = mode[1]; });
    return label;
  }
  function icon(kind) {
    return '<span class="bill-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[kind] || ICONS.tax) + "</svg></span>";
  }
  function presetOff(stay, id) {
    if (id === "chauffage_piscine") return !!stay.poolOffert;
    if (id === "chauffage_jacuzzi") return !!stay.jacuzziOffert;
    if (id === "petit_dejeuner") return !!stay.breakfast;
    return false;
  }
  function billLines(stay, saved) {
    var rows = [];
    function push(row) {
      var listed = saved && saved.offerts ? saved.offerts.indexOf(row.id) >= 0 : false;
      row.offert = saved ? listed : (listed || presetOff(stay, row.id));
      rows.push(row);
    }
    if (stay.poolDays > 0) {
      push({ id: "chauffage_piscine", kind: "pool", label: "Chauffage piscine", detail: stay.poolDays + "\u00A0j", cents: stay.poolDays * (stay.poolRate || 0), toggle: true });
    }
    if (stay.jacuzziDays > 0) {
      push({ id: "chauffage_jacuzzi", kind: "flame", label: "Chauffage jacuzzi", detail: stay.jacuzziDays + "\u00A0j", cents: stay.jacuzziDays * (stay.jacuzziRate || 0), toggle: true });
    }
    (stay.charges || []).forEach(function (charge) {
      push({ id: charge.id, kind: charge.kind || "dinner", label: charge.label, detail: charge.detail || "", cents: charge.cents || 0, toggle: true });
    });
    if (stay.source === "Booking" && stay.tax) {
      var people = (stay.adults || 0) + (stay.children || 0);
      rows.push({
        id: "taxe",
        kind: "tax",
        label: "Taxe de séjour",
        detail: "2,50\u00A0€ × " + people + "\u00A0pers. × " + stay.nights + "\u00A0nuits",
        cents: stay.tax,
        offert: false,
        toggle: false
      });
    }
    return rows;
  }
  function dueOf(lines) {
    var due = 0;
    lines.forEach(function (line) { if (!line.offert) due += line.cents; });
    return due;
  }
  function subtitle(stay) {
    var year = String(stay.departure || stay.arrival || "").slice(0, 4);
    return stay.nom + " · " + calc.rangeLabel(stay.arrival, stay.departure) + (year ? "\u00A0" + year : "");
  }
  function providerText(stay) {
    var providers = stay.providers;
    if (!providers || !providers.names || !providers.names.length) return "";
    return "Déjà réglé aux prestataires\u00A0: " + providers.names.join(", ") + " — " + euros(providers.cents);
  }
  function paint() {
    var root = document.querySelector("[data-cash]");
    var stay = state.stay;
    var paid = state.paid;
    var due = dueOf(state.lines);
    var lines = state.lines.map(function (line) {
      var title = line.label;
      var sub = "";
      if (line.detail) {
        if (line.toggle) title += " · " + line.detail;
        else sub = line.detail;
      }
      var toggle = "";
      if (line.toggle && !(paid && !line.offert)) {
        var on = line.offert ? " is-on" : "";
        var knob = '<span class="bill-knob" aria-hidden="true"></span>';
        toggle = paid
          ? '<span class="bill-switch is-locked' + on + '"><span class="bill-switch-name">Offert</span><span class="bill-ios">' + knob + "</span></span>"
          : '<span class="bill-switch' + on + '"><span class="bill-switch-name">Offert</span><button type="button" class="bill-ios" data-off="' + esc(line.id) + '" role="switch" aria-pressed="' + (line.offert ? "true" : "false") + '" aria-label="Offert">' + knob + "</button></span>";
      } else if (line.toggle) {
        toggle = '<span class="bill-switch is-empty"></span>';
      }
      return '<div class="bill-row' + (line.offert ? " is-offert" : "") + (line.toggle ? "" : " is-tax") + '">' + icon(line.kind)
        + '<span class="bill-text"><span class="bill-label">' + esc(title) + "</span>"
        + (sub ? '<span class="bill-sub">' + esc(sub) + "</span>" : "")
        + "</span>"
        + toggle
        + '<span class="bill-amt">' + esc(euros(line.cents)) + "</span></div>";
    }).join("");
    var provider = providerText(stay);
    var figs = '<div class="cash-line"><span class="cash-word">Total</span><strong class="cash-euro">' + esc(euros(due)) + '</strong></div><em class="cash-dh">' + esc(calc.dirhams(due)) + "</em>";
    var paypal = "";
    if (!paid && state.mode === "paypal") {
      paypal = '<p class="cash-fee"><span>PayPal, frais inclus</span><strong>' + esc(euros(paypalCents(due))) + '</strong></p>'
        + '<p class="cash-note">Frais PayPal à la charge de l’invité · 4,40\u00A0% + 0,35\u00A0€</p>';
    }
    var segment = paid ? "" : '<div class="segment" role="group" aria-label="Mode de paiement">' + MODES.map(function (mode) {
      var on = mode[0] === state.mode;
      return '<button type="button" data-mode="' + mode[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(mode[1]) + "</button>";
    }).join("") + "</div>";
    var action = paid
      ? '<p class="cash-paid"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.8 12.4 10.6 15.2 16.4 9"/></svg><span>Payé le ' + esc(calc.dayText(paid.encaisse_le, false)) + " · " + esc(paid.encaisse_mode) + "</span></p>"
      : segment + paypal + '<button type="button" class="primary" data-pay>Marquer comme payé</button>';
    root.innerHTML = '<a class="back" href="sejour.html?id=' + encodeURIComponent(stay.id) + '">‹ Fiche séjour</a>'
      + "<h1>Encaissement</h1>"
      + '<p class="cash-who"><span>' + esc(subtitle(stay)) + '</span><span class="chip ' + (paid ? "is-paye" : "is-attente") + '">' + (paid ? "Payé" : "En attente") + "</span></p>"
      + '<section class="block"><p class="kicker">À régler à la villa</p>' + lines
      + (provider ? '<p class="cash-done">' + esc(provider) + "</p>" : "")
      + "</section>"
      + '<section class="block cash-sum"><div class="cash-total">' + figs + "</div>"
      + '<p class="cash-rate">Taux appliqué\u00A0: 1\u00A0€ = 10\u00A0DH</p>'
      + action + "</section>";
    fitFigs();
  }
  function fitLine(el, start, min) {
    if (!el || !el.clientWidth) return;
    var size = start;
    el.style.fontSize = size + "px";
    while (size > min && el.scrollWidth > el.clientWidth + 0.5) {
      size -= 0.5;
      el.style.fontSize = size + "px";
    }
  }
  function fitFigs() {
    fitLine(document.querySelector(".cash-euro"), 22, 13);
    fitLine(document.querySelector(".cash-dh"), 12, 9);
    fitLine(document.querySelector(".cash-fee strong"), 18, 12);
  }
  function openSheet() {
    var due = dueOf(state.lines);
    var amount = state.mode === "paypal" ? paypalCents(due) : due;
    var summary = document.querySelector("[data-pay-summary]");
    summary.textContent = euros(amount).replace("\u00A0", " ") + " · " + modeLabel(state.mode);
    document.querySelector("[data-pay-sheet]").hidden = false;
    document.querySelector("[data-pay-back]").hidden = false;
  }
  function closeSheet() {
    document.querySelector("[data-pay-sheet]").hidden = true;
    document.querySelector("[data-pay-back]").hidden = true;
  }
  function persist() {
    var due = dueOf(state.lines);
    var amount = state.mode === "paypal" ? paypalCents(due) : due;
    var record = {
      encaisse_total_eur: Math.round(amount) / 100,
      encaisse_mode: modeLabel(state.mode),
      encaisse_le: state.stay.departure,
      offerts: state.lines.filter(function (line) { return line.offert; }).map(function (line) { return line.id; })
    };
    var bag = readPay();
    bag[state.stay.id] = record;
    try { localStorage.setItem(PAY_KEY, JSON.stringify(bag)); } catch (e) {}
    state.paid = record;
    if (window.AdminStays && window.AdminStays.sheet && window.AdminStays.post) {
      var copy = Object.assign({}, state.stay, record, { offerts: record.offerts.join(",") });
      window.AdminStays.post({
        action: "save-stay",
        test: shell.TEST_MODE ? "1" : "",
        token: shell.session(),
        stay: window.AdminStays.sheet(copy)
      });
    }
    closeSheet();
    paint();
  }
  function bind(root) {
    root.addEventListener("click", function (event) {
      var off = event.target.closest("[data-off]");
      if (off && !state.paid) {
        state.lines.forEach(function (line) {
          if (line.id === off.getAttribute("data-off")) line.offert = !line.offert;
        });
        paint();
        return;
      }
      var mode = event.target.closest("[data-mode]");
      if (mode) {
        state.mode = mode.getAttribute("data-mode");
        paint();
        return;
      }
      if (event.target.closest("[data-pay]")) openSheet();
    });
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-pay-confirm]")) persist();
      else if (event.target.closest("[data-pay-cancel]") || event.target.hasAttribute("data-pay-back")) closeSheet();
    });
  }
  function withMeals(stay, items) {
    if (!stay || (stay.charges && stay.charges.length) || !items) return stay;
    var meals = { breakfast: ["petit_dejeuner", "Petit-déjeuner", 0], dinner: ["diner", "Dîner", 0] };
    var names = [];
    var providerCents = 0;
    items.forEach(function (item) {
      if (String(item.stay || "") !== String(stay.id)) return;
      var service = String(item.service || "").toLowerCase();
      var cents = Math.round((Number(item.total) || 0) * 10);
      if (service.indexOf("petit") >= 0) meals.breakfast[2] += cents;
      else if (service.indexOf("ner") >= 0) meals.dinner[2] += cents;
      else if (service.indexOf("transfert") >= 0 || service.indexOf("quad") >= 0 || service.indexOf("massage") >= 0) {
        var name = service.indexOf("quad") >= 0 ? "quad" : (service.indexOf("massage") >= 0 ? "massage" : "transfert");
        if (names.indexOf(name) < 0) names.push(name);
        providerCents += cents;
      }
    });
    stay.charges = ["breakfast", "dinner"].filter(function (key) { return meals[key][2] > 0; }).map(function (key) {
      return { id: meals[key][0], kind: key, label: meals[key][1], cents: meals[key][2] };
    });
    if (names.length) stay.providers = { names: names, cents: providerCents };
    return stay;
  }
  function start(stay) {
    var root = document.querySelector("[data-cash]");
    if (!stay) {
      root.innerHTML = '<a class="back" href="sejours.html">‹ Séjours</a><p class="empty">Séjour introuvable.</p>';
      return;
    }
    var saved = readPay()[stay.id] || null;
    state = { stay: stay, lines: billLines(stay, saved), mode: "eur", paid: saved };
    bind(root);
    paint();
  }
  function boot() {
    var root = document.querySelector("[data-cash]");
    if (!root || document.body.classList.contains("is-locked") || !calc) return;
    var id = query("sejour") || query("id");
    if (shell.TEST_MODE && window.AdminStays) {
      start(window.AdminStays.find(id));
      return;
    }
    if (!shell.SCRIPT_URL || !window.fetch) {
      start(null);
      return;
    }
    var token = encodeURIComponent(shell.session());
    var base = shell.SCRIPT_URL + "?token=" + token + "&id=" + encodeURIComponent(id);
    Promise.all([
      window.fetch(base + "&action=stay").then(function (res) { return res.json(); }),
      window.fetch(shell.SCRIPT_URL + "?token=" + token + "&action=demandes").then(function (res) { return res.json(); })
    ]).then(function (pair) {
      var stay = pair[0] && pair[0].stay;
      if (stay && window.AdminCalc) {
        stay.nights = calc.nights(stay.arrival, stay.departure);
        if (stay.source === "Booking") stay.tax = calc.bookingTax((stay.adults || 0) + (stay.children || 0), stay.nights);
      }
      start(withMeals(stay, (pair[1] && pair[1].items) || []));
    }).catch(function () { start(null); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
