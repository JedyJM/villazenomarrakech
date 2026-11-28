/* Mes demandes and the stay recap. French. Amounts on the recap are euros. */
(function () {
  "use strict";

  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var EURO_DH = 10;
  var ICONS = {
    breakfast: '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"/><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"/><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"/><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"/><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"/>',
    lunch: '<circle cx="12" cy="3.2" r="1.15"/><path d="M12 4.6 18.2 12.2H5.8L12 4.6z"/><path d="M4.8 14h14.4"/><path d="M6.4 14c.7 3.1 2.9 5 5.6 5s4.9-1.9 5.6-5"/>',
    dinner: '<path d="M16.5 4.8A7.2 7.2 0 1 0 16.5 19 5.4 5.4 0 0 1 16.5 4.8z"/>',
    menage: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
    quad: '<path d="M2.75 17a3.25 3.25 0 1 0 6.5 0a3.25 3.25 0 1 0-6.5 0m12 0a3.25 3.25 0 1 0 6.5 0a3.25 3.25 0 1 0-6.5 0M2.5 12.5c1-1.25 2.25-2 4-2h2l1 2h5l1-2h2c1.75 0 3 .75 4 2m-13-4h4m3 2l1-4H19"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    flower: '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>',
    pool: '<path d="M19 5a2 2 0 0 0-2 2v11"/><path d="M9 5a2 2 0 0 0-2 2v11"/><path d="M7 9h10"/><path d="M7 13h10"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    tax: '<path d="M6 3.5h12v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2v-17z"/><path d="M9 8h6M9 12h6M9 16h4"/>'
  };

  function isEn() {
    return (document.documentElement.lang || "fr").slice(0, 2) === "en";
  }
  function text(fr, en) {
    return isEn() ? en : fr;
  }
  function queryFlag(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function euros(amount) {
    var n = Math.round(Number(amount) * 100) / 100;
    var body = (n % 1) ? n.toFixed(2).replace(".", ",") : String(Math.round(n));
    if (isEn()) return "€" + body.replace(",", ".");
    return body + "\u00A0€";
  }
  function dirhams(eurosAmount) {
    var cents = Math.round(Number(eurosAmount) * 100);
    var dhCents = cents * EURO_DH;
    var neg = dhCents < 0;
    dhCents = Math.abs(dhCents);
    var whole = Math.floor(dhCents / 100);
    var frac = dhCents % 100;
    var text = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    if (frac) text += "," + (frac < 10 ? "0" : "") + frac;
    return (neg ? "−" : "") + text + "\u00A0DH";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  // Local date (+ time when given). hasTime is false when there is no
  // usable time: the row then shows the day only, never a made-up 00:00.
  function parseWhen(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(date || ""))) return null;
    var parts = String(date).slice(0, 10).split("-");
    var match = String(time || "").match(/(\d{1,2})(?:\s*[:hH]\s*(\d{2}))?/);
    var hour = match ? Number(match[1]) : 0;
    var minute = match && match[2] ? Number(match[2]) : 0;
    if (hour > 23 || minute > 59) { match = null; hour = 0; minute = 0; }
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hour, minute, 0, 0);
    d.hasTime = !!match;
    return d;
  }
  /* Requested day and time of a demande. The script sends when_date
     (details.date) and when_time (details.time_label || details.time).
     Services that store them under other keys (transfert:
     flight_arrival_time / pickup_time; location_voiture: start_date +
     pickup_time) are read here too when the script sends them. */
  // Shared field model (js/vz-fields.js): the script sends when_date /
  // when_time; older answers are completed from the local copy (fillLocal).
  function whenDateOf(item) {
    return item.when_date || window.VZFields.when(item.service, item).date;
  }
  function whenTimeOf(item) {
    return item.when_time || window.VZFields.when(item.service, item).time;
  }
  function whenOf(item) {
    return parseWhen(whenDateOf(item), whenTimeOf(item));
  }
  function clock(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }
  function dayLabel(date) {
    return date.getDate() + "\u00A0" + MONTHS[date.getMonth()];
  }
  function canonStatus(value) {
    var s = String(value || "").toLowerCase();
    if (s === "confirmée" || s === "confirmee") return "Confirmée";
    if (s === "terminée" || s === "terminee") return "Terminée";
    if (s === "annulée" || s === "annulee") return "Annulée";
    return "Envoyée";
  }
  function effectiveStatus(item) {
    var status = canonStatus(item.status);
    if (status !== "Confirmée") return status;
    var when = whenOf(item);
    if (!when) return status;
    // Without a time: done the day after.
    var end = when.getTime() + (when.hasTime ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    if (Date.now() >= end) return "Terminée";
    return status;
  }
  function whenText(item) {
    var when = whenOf(item);
    if (!when) return "";
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
    var diff = Math.round((day - today) / 86400000);
    var label = dayLabel(when);
    if (diff === 0) label = when.hasTime && when.getHours() >= 17 ? "Ce soir" : "Aujourd’hui";
    else if (diff === 1) label = "Demain";
    return when.hasTime ? label + " · " + clock(when) : label;
  }
  /* "Confirmée le 25 nov. à 14:32" from date_confirmation (Demandes,
     "yyyy-MM-dd HH:mm", Africa/Casablanca). No text when the script does
     not send it. */
  function confirmedText(item) {
    if (item.status !== "Confirmée") return "";
    var m = String(item.date_confirmation || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return "";
    var month = (isEn() ? MONTHS_EN : MONTHS)[Number(m[2]) - 1];
    if (!month) return "";
    var day = Number(m[3]) + "\u00A0" + month;
    if (isEn()) return "Confirmed on " + day + (m[4] ? " at " + m[4] + ":" + m[5] : "");
    return "Confirmée le " + day + (m[4] ? " à " + m[4] + ":" + m[5] : "");
  }
  function stayDates(stay) {
    if (!stay || !stay.arrival) return "";
    var a = parseWhen(stay.arrival, "12:00");
    var b = parseWhen(stay.departure, "12:00");
    if (!a || !b) return "";
    var end = dayLabel(b);
    if (a.getFullYear() === b.getFullYear()) end += " " + b.getFullYear();
    return dayLabel(a) + " → " + end;
  }
  function kindOf(item) {
    if (item.service === "restauration") {
      if (item.meal === "breakfast") return "breakfast";
      if (item.meal === "dinner") return "dinner";
      return "lunch";
    }
    if (item.service === "activites") return item.activity === "quad" || item.sous_type === "quad" ? "quad" : "quad";
    if (item.service === "transfert" || item.service === "course" || item.service === "location_voiture") return "car";
    if (item.service === "massage") return "flower";
    if (item.service === "piscine") return "pool";
    return "menage";
  }
  function guestName(item) {
    if (item.service === "restauration") {
      if (item.meal === "breakfast") return text("Petit-déjeuner", "Breakfast");
      if (item.meal === "dinner") return text("Dîner", "Dinner");
      return text("Déjeuner", "Lunch");
    }
    if (item.service === "activites") {
      if (item.activity === "quad" || item.sous_type === "quad") return "Quad";
      return item.activity_label || "Activité";
    }
    if (item.service === "transfert") return item.trip_type === "city" ? "Trajet en ville" : "Transfert aéroport";
    if (item.service === "course") return "Trajet en ville";
    if (item.service === "location_voiture") return "Location de voiture";
    if (item.service === "massage") return "Massage";
    if (item.service === "piscine") return "Piscine";
    if (item.service === "menage") return "Ménage";
    return "Demande";
  }
  function detailLine(item) {
    if (item.detail) return item.detail;
    if (item.service === "restauration") {
      var people = item.people ? item.people + " pers." : "";
      return [people, item.dish || ""].filter(Boolean).join(" · ");
    }
    if (item.service === "menage") return item.scope === "chambres" ? "Chambres uniquement" : "Toute la maison";
    if (item.service === "activites") return item.activity_label || "";
    return "";
  }
  function eurosOf(item) {
    if (item.total == null || item.total === "") return null;
    var n = Number(item.total);
    if (!isFinite(n)) return null;
    if (item.unit === "dh" || (item.unit !== "eur" && item.service !== "restauration")) return Math.round(n / EURO_DH * 100) / 100;
    return n;
  }
  function providerService(item) {
    return item.service === "transfert" || item.service === "activites" || item.service === "massage";
  }
  function billLabel(item) {
    if (item.bill) return item.bill;
    var people = Number(item.people) || 0;
    var extra = Number(item.supplement) || 0;
    var total = eurosOf(item);
    var unit = people ? Math.round(((total || 0) - extra) / people) : 0;
    var text = "";
    if (people && unit) text = people + " × " + unit + "\u00A0€";
    if (extra) text += (text ? " + " : "") + "supplément " + extra + "\u00A0€";
    if (item.dish) text += (text ? " · " : "") + item.dish;
    return text;
  }

  function demoPack() {
    return {
      stay: {
        arrival: "2026-11-21",
        departure: "2026-11-28",
        pool: { days: 4, rate: 60, offert: false },
        jacuzzi: { days: 3, rate: 35, offert: true }
      },
      items: [
        { service: "transfert", trip_type: "arrival", total: 350, unit: "dh", status: "Confirmée", when_date: "2026-11-27", when_time: "15:30", date_creation: "2026-11-24T10:00:00", date_confirmation: "2026-11-25 14:32" },
        { service: "location_voiture", total: "", status: "Envoyée", start_date: "2026-11-23", pickup_time: "10:00", date_creation: "2026-11-21T13:00:00" },
        { service: "restauration", meal: "breakfast", people: 2, dish: "", total: 20, unit: "eur", status: "Envoyée", when_date: "2026-11-22", when_time: "10:00", date_creation: "2026-11-21T12:00:00" },
        { service: "restauration", meal: "dinner", people: 4, dish: "Tajine d’agneau aux pruneaux", total: 80, unit: "eur", status: "Confirmée", when_date: "2026-11-21", when_time: "20:00", date_creation: "2026-11-21T09:00:00", date_confirmation: "2026-11-21 10:05" },
        { service: "piscine", total: "", status: "Envoyée", when_date: "2026-11-24", when_time: "", date_creation: "2026-11-21T08:30:00" },
        { service: "restauration", meal: "lunch", people: 4, dish: "Tajine d’agneau aux pruneaux", total: 80, unit: "eur", status: "Terminée", when_date: "2026-11-15", when_time: "13:00", date_creation: "2026-11-14T18:00:00" },
        { service: "activites", activity: "quad", sous_type: "quad", activity_label: "1 quad · 1 personne", total: 300, unit: "dh", status: "Terminée", when_date: "2026-11-14", when_time: "14:30", date_creation: "2026-11-13T16:00:00" },
        { service: "menage", scope: "maison", total: "", status: "Annulée", when_date: "2026-11-16", when_time: "11:00", date_creation: "2026-11-15T08:00:00" }
      ]
    };
  }

  function bookingPack() {
    return {
      stay: {
        arrival: "2026-11-20",
        departure: "2026-11-27",
        source: "Booking",
        adults: 3,
        children: 2
      },
      items: [
        { service: "restauration", meal: "lunch", people: 5, dish: "Tajine de poulet aux légumes", total: 100, unit: "eur", status: "Terminée", when_date: "2026-11-21", when_time: "13:00", date_creation: "2026-11-20T18:00:00" }
      ]
    };
  }

  function bookingTaxRow(stay) {
    if (!stay || String(stay.source || "").toLowerCase() !== "booking") return null;
    var people = (Number(stay.adults) || 0) + (Number(stay.children) || 0);
    var a = parseWhen(stay.arrival, "12:00");
    var b = parseWhen(stay.departure, "12:00");
    if (!people || !a || !b) return null;
    var nights = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (nights < 1) return null;
    return {
      label: "Taxe de séjour",
      detail: "2,50\u00A0€ × " + people + "\u00A0pers. × " + nights + "\u00A0nuit" + (nights > 1 ? "s" : ""),
      amount: Math.round(people * nights * 250) / 100,
      offert: false,
      kind: "tax"
    };
  }

  function sampleStay(id) {
    if (id !== "cmartin26a") return null;
    return {
      stay: {
        id: "cmartin26a",
        arrival: "2026-12-12",
        departure: "2026-12-19",
        source: "Airbnb",
        adults: 2,
        children: 2,
        pool: { days: 7, rate: 60, offert: false },
        jacuzzi: { days: 7, rate: 35, offert: false }
      },
      items: [
        { service: "restauration", meal: "breakfast", people: 0, total: 30, unit: "eur", status: "Terminée", when_date: "2026-12-16", when_time: "09:00", date_creation: "2026-12-16T08:00:00" },
        { service: "restauration", meal: "dinner", people: 0, total: 80, unit: "eur", status: "Terminée", when_date: "2026-12-16", when_time: "20:00", date_creation: "2026-12-16T12:00:00" }
      ]
    };
  }
  function storedPayment(id) {
    var api = window.GuestRequests;
    if (!api || !api.TEST_MODE || !id) return null;
    try {
      var bag = JSON.parse(localStorage.getItem("vz.admin.encaissement") || "{}");
      return bag[id] || null;
    } catch (e) { return null; }
  }
  function applyStoredPayment(pack, id) {
    var stored = storedPayment(id || (pack.stay && pack.stay.id) || "");
    if (!stored || !stored.encaisse_le) return pack;
    var stay = Object.assign({}, pack.stay || {}, {
      id: (pack.stay && pack.stay.id) || id,
      encaisse_le: stored.encaisse_le,
      encaisse_mode: stored.encaisse_mode,
      encaisse_total_eur: stored.encaisse_total_eur,
      offerts: stored.offerts
    });
    return { items: pack.items || [], stay: stay };
  }
  /* The guest's own copy of each demande (localStorage villazeno.demandes,
     full fields). Fills the requested time when an older script answer
     lacks it (v18 sends only time_label || time). */
  function fillLocal(items) {
    var local = {};
    try {
      (JSON.parse(localStorage.getItem("villazeno.demandes") || "[]") || []).forEach(function (record) {
        if (record && record.id) local[record.id] = record;
      });
    } catch (e) {}
    (items || []).forEach(function (item) {
      var record = local[item.id];
      if (!record || (item.when_date && item.when_time)) return;
      var when = window.VZFields.when(record.service || item.service, record.fields || {});
      if (!item.when_date) item.when_date = when.date;
      if (!item.when_time) item.when_time = when.time;
    });
    return items;
  }
  function demoPackFor() {
    if (queryFlag("demo") === "1") return demoPack();
    if (queryFlag("demo") === "booking") return bookingPack();
    return null;
  }

  function prepare(pack) {
    var items = (pack.items || []).map(function (item) {
      item.status = effectiveStatus(item);
      return item;
    });
    items.sort(function (a, b) {
      return String(b.date_creation || "").localeCompare(String(a.date_creation || ""));
    });
    return { items: items, stay: pack.stay || null };
  }

  function iconSvg(kind) {
    return '<span class="demand-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[kind] || ICONS.menage) + "</svg></span>";
  }

  function paintList(root, pack, emptyIsSure) {
    var data = prepare(pack);
    var list = root.querySelector("[data-demand-list]");
    var empty = root.querySelector("[data-demand-empty]");
    var dates = root.querySelector("[data-stay-dates]");
    var sum = root.querySelector("[data-demand-sum]");
    if (dates) dates.textContent = stayDates(data.stay);
    var waiting = data.items.filter(function (item) { return item.status === "Envoyée"; }).length;
    if (sum) {
      var n = data.items.length;
      sum.textContent = n + " demande" + (n > 1 ? "s" : "") + " · " + waiting + " en attente";
    }
    if (!data.items.length) {
      // « Aucune demande » only after a successful empty answer.
      if (empty) empty.hidden = !emptyIsSure;
      if (list) list.hidden = true;
      if (sum && !emptyIsSure) sum.textContent = "";
      return;
    }
    if (empty) empty.hidden = true;
    list.hidden = false;
    list.innerHTML = data.items.map(function (item) {
      var status = item.status;
      var chip = status === "Annulée" ? "status-annulee" : status === "Confirmée" ? "status-confirmee" : status === "Terminée" ? "status-terminee" : "status-envoyee";
      var price = eurosOf(item);
      var priceHtml = price == null ? "" : "<b>" + esc(euros(price)) + "</b>";
      var confirmed = confirmedText(item);
      return '<li class="demand-card' + (confirmed ? " has-confirmed" : "") + '">' + iconSvg(kindOf(item))
        + '<strong>' + esc(guestName(item)) + '</strong>'
        + '<span class="status-chip ' + chip + '">' + esc(status) + '</span>'
        + '<p class="demand-detail">' + esc(detailLine(item)) + '</p>'
        + '<p class="demand-when">' + esc(whenText(item)) + '</p>'
        + (confirmed ? '<p class="demand-confirmed">' + esc(confirmed) + '</p>' : '')
        + priceHtml
        + '</li>';
    }).join("");
  }

  function offertSet(stay) {
    var raw = stay && stay.offerts;
    var list = Array.isArray(raw) ? raw : String(raw || "").split(",");
    var map = {};
    list.forEach(function (id) {
      var key = String(id || "").trim();
      if (key) map[key] = true;
    });
    return map;
  }
  function paidWhen(iso) {
    var parts = String(iso || "").slice(0, 10).split("-");
    if (parts.length < 3) return "";
    var month = (isEn() ? MONTHS_EN : MONTHS)[Number(parts[1]) - 1] || "";
    return Number(parts[2]) + (isEn() ? " " : "\u00A0") + month;
  }
  // Payment method name only: the Sheet stores « Espèces € » / « Espèces DH »
  // (admin Encaissement needs the currency), but on the récap header the
  // currency belongs to the amount alone → « Espèces · 137,50 € ».
  function modeName(mode) {
    var value = String(mode || "").replace(/\s*(€|eur|euros?|dh|dhs|mad|dirhams?)\s*$/i, "").trim();
    if (isEn() && /^esp[eè]ces$/i.test(value)) return "Cash";
    return value;
  }
  function showSettled(root, stay, linesHtml, due) {
    var card = root.querySelector("[data-settled]");
    var billCard = root.querySelector("[data-bill-card]");
    var dock = root.querySelector("[data-pay-dock]");
    if (!card) return false;
    var choice = dock ? dock.querySelector(".pay-choice") : null;
    if (!stay || !stay.encaisse_le) {
      card.hidden = true;
      if (billCard) billCard.hidden = false;
      if (dock) dock.hidden = false;
      if (choice) choice.hidden = false;
      return false;
    }
    var title = card.querySelector("[data-settled-title]");
    var line = card.querySelector("[data-settled-line]");
    var list = card.querySelector("[data-settled-lines]");
    if (title) title.textContent = text("Réglé à la villa", "Settled at the villa");
    var amount = stay.encaisse_total_eur != null && stay.encaisse_total_eur !== "" ? Number(stay.encaisse_total_eur) : due;
    if (line) {
      line.textContent = text("Réglé le ", "Paid on ") + paidWhen(stay.encaisse_le) + " · " + modeName(stay.encaisse_mode) + " · " + euros(amount);
    }
    // Settled (2026-11-27 review): the banner says so, and the detail stays
    // visible: « À régler à la villa » lines with « Total réglé », « Déjà
    // réglé aux prestataires », and the 1 € = 10 DH rate. Only the payment
    // buttons go away.
    if (list) { list.innerHTML = ""; list.hidden = true; }
    card.hidden = false;
    if (billCard) billCard.hidden = false;
    if (dock) dock.hidden = false;
    if (choice) choice.hidden = true;
    return true;
  }
  function heatingRow(label, heat) {
    if (!heat || !heat.days || !heat.rate) return null;
    var amount = Number(heat.days) * Number(heat.rate);
    return { label: label, detail: heat.days + " × " + heat.rate + "\u00A0€", amount: amount, offert: !!heat.offert, kind: heat.kind };
  }

  function paintRecap(root, pack) {
    var data = prepare(pack);
    var bill = root.querySelector("[data-bill]");
    var paid = root.querySelector("[data-paid]");
    var paidCard = root.querySelector("[data-paid-card]");
    var totalNode = root.querySelector("[data-total]");
    var feeNode = root.querySelector("[data-fee]");
    var cashBtn = root.querySelector("[data-pay='cash']");
    var payBtn = root.querySelector("[data-pay='paypal']");
    var rows = [];
    var poolHeat = data.stay && data.stay.pool;
    var jacuzziHeat = data.stay && data.stay.jacuzzi;
    if (poolHeat) poolHeat.kind = "pool";
    if (jacuzziHeat) jacuzziHeat.kind = "flame";
    var pool = heatingRow(text("Chauffage piscine", "Pool heating"), poolHeat);
    var jacuzzi = heatingRow(text("Chauffage jacuzzi", "Jacuzzi heating"), jacuzziHeat);
    if (pool) { pool.id = "chauffage_piscine"; rows.push(pool); }
    if (jacuzzi) { jacuzzi.id = "chauffage_jacuzzi"; rows.push(jacuzzi); }
    var tax = bookingTaxRow(data.stay);
    if (tax) {
      tax.label = text("Taxe de séjour", "Tourist tax");
      tax.id = "taxe";
      rows.push(tax);
    }
    data.items.forEach(function (item) {
      if (item.service !== "restauration" || item.status !== "Terminée" || item.service === "menage") return;
      var mealId = item.meal === "breakfast" ? "petit_dejeuner" : item.meal === "dinner" ? "diner" : "dejeuner";
      rows.push({ id: mealId, label: guestName(item), detail: billLabel(item), amount: eurosOf(item) || 0, offert: !!item.offert, kind: kindOf(item) });
    });
    var offered = offertSet(data.stay);
    rows.forEach(function (row) {
      if (row.id && offered[row.id]) row.offert = true;
    });
    var due = 0;
    function moneyLine(row) {
      if (!row.offert) due += row.amount;
      var price = '<span class="' + (row.offert ? "is-offert" : "") + '">' + esc(euros(row.amount)) + "</span>";
      var tag = row.offert ? "<small>" + esc(text("Offert", "Complimentary")) + "</small>" : "";
      return "<li>" + iconSvg(row.kind || "menage") + "<span><strong>" + esc(row.label) + "</strong><em>" + esc(row.detail) + "</em></span><b>" + price + tag + "</b></li>";
    }
    var linesHtml = rows.map(moneyLine).join("");
    var settled = data.items.filter(function (item) {
      return providerService(item) && item.status === "Terminée" && eurosOf(item) != null;
    });
    if (paidCard) paidCard.hidden = !settled.length;
    if (paid) {
      paid.innerHTML = settled.map(function (item) {
        return "<li>" + iconSvg(kindOf(item)) + "<span><strong>" + esc(guestName(item)) + "</strong><em>" + esc(detailLine(item)) + "</em></span><b>" + esc(euros(eurosOf(item))) + "<small>RÉGLÉ</small></b></li>";
      }).join("");
    }
    function paintTotal(mode, settledNow) {
      var paypal = mode === "paypal" && !settledNow;
      var grand = due;
      var fee = 0;
      if (paypal) {
        grand = Math.round((due * 1.044 + 0.35) * 100) / 100;
        fee = Math.round((grand - due) * 100) / 100;
      }
      var feeHtml = paypal
        ? '<li class="recap-fee-line"><span>' + esc(text("Frais PayPal (4,4\u00A0% + 0,35\u00A0€)", "PayPal fee (4.4% + €0.35)")) + "</span><b>" + esc(euros(fee)) + "</b></li>"
        : "";
      bill.innerHTML = linesHtml + feeHtml
        + '<li class="recap-sum" data-recap-total="' + grand + '"><span>' + esc(settledNow ? text("Total réglé", "Total settled") : text("Total à régler", "Total due")) + "</span><b><strong>" + esc(euros(grand)) + "</strong><small>" + esc(text("soit ", "or ") + dirhams(grand)) + "</small></b></li>";
      if (feeNode) feeNode.hidden = true;
      if (payBtn) {
        var testPay = window.GuestRequests && window.GuestRequests.TEST_MODE;
        if (testPay || typeof window.paypalPayUrl !== "function") {
          payBtn.href = "#";
          payBtn.removeAttribute("target");
          payBtn.removeAttribute("rel");
        } else {
          var stayId = data.stay && data.stay.id ? data.stay.id : "";
          payBtn.href = window.paypalPayUrl(grand, stayId);
          payBtn.target = "_blank";
          payBtn.rel = "noopener";
        }
      }
      if (cashBtn) cashBtn.setAttribute("aria-pressed", paypal ? "false" : "true");
      if (payBtn) payBtn.setAttribute("aria-pressed", paypal ? "true" : "false");
    }
    var settledNow = showSettled(root, data.stay, linesHtml, due);
    paintTotal("cash", settledNow);
    root.__paintTotal = paintTotal;
    if (root.__payBound) return;
    root.__payBound = true;
    root.querySelectorAll("[data-pay]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        if (button.getAttribute("data-pay") === "paypal") {
          if (button.getAttribute("aria-pressed") !== "true") {
            event.preventDefault();
            root.__paintTotal("paypal");
            return;
          }
          if (window.GuestRequests && window.GuestRequests.TEST_MODE) event.preventDefault();
        }
        if (button.getAttribute("data-pay") === "cash") {
          event.preventDefault();
          root.__paintTotal("cash");
        }
      });
    });
  }

  /* One state line under the title: loading | updating | error | invalid |
     expired. Never a blank page: before any answer the loading line shows,
     a failure shows the error with « Réessayer ». */
  function stateNode(root) {
    var node = root.querySelector("[data-demand-state]");
    if (node) return node;
    node = document.createElement("div");
    node.className = "demand-state";
    node.setAttribute("data-demand-state", "");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    var head = root.querySelector(".demand-head") || root.querySelector("h1");
    var anchor = head && head.parentNode ? head : null;
    if (anchor) anchor.parentNode.insertBefore(node, anchor.nextSibling);
    else root.insertBefore(node, root.firstChild);
    return node;
  }
  function setState(root, name, snap, retry) {
    var node = stateNode(root);
    node.setAttribute("data-state", name);
    node.removeAttribute("data-api-error");
    if (name === "ok") { node.hidden = true; node.textContent = ""; return; }
    node.hidden = false;
    if (name === "loading") { node.textContent = text("Chargement de vos demandes…", "Loading your requests…"); return; }
    if (name === "updating") { node.textContent = text("Mise à jour…", "Updating…"); return; }
    window.VZApi.showError(node, (snap && snap.error) || { kind: name === "invalid" ? "invalid_link" : name === "expired" ? "expired" : "network" }, retry, {
      // A preview without /exec keeps the « contretemps » message (VZApi.message).
      text: name === "error" && !(snap && snap.error && snap.error.kind === "unavailable") ? text("Impossible de charger vos demandes. Vérifiez le réseau, puis réessayez.", "Your requests could not be loaded. Check your connection, then try again.") : ""
    });
  }

  function boot() {
    var listRoot = document.querySelector("[data-demand-page]");
    var recapRoot = document.querySelector("[data-recap-page]");
    if (!listRoot && !recapRoot) return;
    var roots = [listRoot, recapRoot].filter(Boolean);
    function paintPack(pack, emptyIsSure) {
      if (listRoot) paintList(listRoot, pack, emptyIsSure);
      if (recapRoot) paintRecap(recapRoot, pack);
    }
    var demo = demoPackFor();
    if (demo) { paintPack(demo, true); return; }
    var api = window.GuestRequests;
    var gs = window.GuestStay;
    var id = gs ? gs.id() : "";
    if (api && api.TEST_MODE && sampleStay(id)) { paintPack(applyStoredPayment(sampleStay(id), id), true); return; }
    if (!gs || !id) { paintPack({ items: [], stay: null }, true); return; }
    function retry() { gs.load({ force: true }); }
    function render(snap) {
      try {
        var has = !!(snap.stay || snap.items);
        var pack = applyStoredPayment({ items: fillLocal((snap.items || []).slice()), stay: snap.stay }, id);
        if (has) paintPack(pack, snap.state === "ok");
        var name = snap.state;
        if (name === "loading") name = has ? "updating" : "loading";
        roots.forEach(function (root) { setState(root, name, snap, retry); });
      } catch (e) {
        roots.forEach(function (root) { setState(root, "error", { error: { kind: "server" } }, retry); });
      }
    }
    gs.onChange(render);
    render(gs.snapshot());
    gs.load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
