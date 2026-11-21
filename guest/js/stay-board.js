/* Mes demandes and the stay recap. French. Amounts on the recap are euros. */
(function () {
  "use strict";

  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
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
    tub: '<path d="M4.2 14.2c.5 3.5 3.7 5.8 7.8 5.8s7.3-2.3 7.8-5.8"/><path d="M3.2 14.2h17.6"/><path d="M6.6 14.2c.35 1.8 2.2 3.1 5.4 3.1s5.05-1.3 5.4-3.1"/><path d="M7.2 10.6c1.15-1.15 1.15-2.15 0-3.2"/><path d="M12 9.6c1.25-1.25 1.25-2.35 0-3.5"/><path d="M16.8 10.6c1.15-1.15 1.15-2.15 0-3.2"/>'
  };

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
    var text = (n % 1) ? n.toFixed(2).replace(".", ",") : String(n);
    return text + "\u00A0€";
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
  function parseWhen(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(date || ""))) return null;
    var parts = String(date).slice(0, 10).split("-");
    var match = String(time || "").match(/(\d{1,2})(?:\s*[:hH]\s*(\d{2}))?/);
    var hour = match ? Number(match[1]) : 0;
    var minute = match && match[2] ? Number(match[2]) : 0;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hour, minute, 0, 0);
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
    var when = parseWhen(item.when_date, item.when_time);
    if (!when) return status;
    if (Date.now() >= when.getTime() + 2 * 60 * 60 * 1000) return "Terminée";
    return status;
  }
  function whenText(item) {
    var when = parseWhen(item.when_date, item.when_time);
    if (!when) return [item.when_date, item.when_time].filter(Boolean).join(" · ");
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
    var diff = Math.round((day - today) / 86400000);
    var hour = clock(when);
    if (diff === 0) return (when.getHours() >= 17 ? "Ce soir" : "Aujourd’hui") + " · " + hour;
    if (diff === 1) return "Demain · " + hour;
    return dayLabel(when) + " · " + hour;
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
    if (item.service === "transfert") return "car";
    if (item.service === "massage") return "flower";
    if (item.service === "piscine") return "pool";
    return "menage";
  }
  function guestName(item) {
    if (item.service === "restauration") {
      if (item.meal === "breakfast") return "Petit-déjeuner";
      if (item.meal === "dinner") return "Dîner";
      return "Déjeuner";
    }
    if (item.service === "activites") {
      if (item.activity === "quad" || item.sous_type === "quad") return "Quad";
      return item.activity_label || "Activité";
    }
    if (item.service === "transfert") return item.trip_type === "city" ? "Trajet en ville" : "Transfert aéroport";
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
        { service: "restauration", meal: "breakfast", people: 2, dish: "", total: 20, unit: "eur", status: "Envoyée", when_date: "2026-11-22", when_time: "10:00", date_creation: "2026-11-21T12:00:00" },
        { service: "restauration", meal: "dinner", people: 4, dish: "Tajine d’agneau aux pruneaux", total: 80, unit: "eur", status: "Confirmée", when_date: "2026-11-21", when_time: "20:00", date_creation: "2026-11-21T09:00:00" },
        { service: "restauration", meal: "lunch", people: 4, dish: "Tajine d’agneau aux pruneaux", total: 80, unit: "eur", status: "Terminée", when_date: "2026-11-15", when_time: "13:00", date_creation: "2026-11-14T18:00:00" },
        { service: "activites", activity: "quad", sous_type: "quad", activity_label: "1 quad · 1 personne", total: 300, unit: "dh", status: "Terminée", when_date: "2026-11-14", when_time: "14:30", date_creation: "2026-11-13T16:00:00" },
        { service: "menage", scope: "maison", total: "", status: "Annulée", when_date: "2026-11-16", when_time: "11:00", date_creation: "2026-11-15T08:00:00" }
      ]
    };
  }

  function loadPack() {
    if (queryFlag("demo") === "1") return Promise.resolve(demoPack());
    var api = window.GuestRequests;
    var stay = api && api.stayId ? api.stayId() : "";
    if (!api || !api.listDemandes || !stay) return Promise.resolve({ items: [], stay: null });
    return api.listDemandes(stay).then(function (data) {
      if (data && data.items) return data;
      return { items: data || [], stay: null };
    }).catch(function () { return { items: [], stay: null }; });
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

  function paintList(root, pack) {
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
      if (empty) empty.hidden = false;
      if (list) list.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    list.hidden = false;
    list.innerHTML = data.items.map(function (item) {
      var status = item.status;
      var chip = status === "Annulée" ? "status-annulee" : status === "Confirmée" ? "status-confirmee" : status === "Terminée" ? "status-terminee" : "status-envoyee";
      var price = eurosOf(item);
      var priceHtml = price == null ? "" : "<b>" + esc(euros(price)) + "</b>";
      return '<li class="demand-card">' + iconSvg(kindOf(item))
        + '<strong>' + esc(guestName(item)) + '</strong>'
        + '<span class="status-chip ' + chip + '">' + esc(status) + '</span>'
        + '<p class="demand-detail">' + esc(detailLine(item)) + '</p>'
        + '<p class="demand-when">' + esc(whenText(item)) + '</p>'
        + priceHtml
        + '</li>';
    }).join("");
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
    if (jacuzziHeat) jacuzziHeat.kind = "tub";
    var pool = heatingRow("Chauffage piscine", poolHeat);
    var jacuzzi = heatingRow("Chauffage jacuzzi", jacuzziHeat);
    if (pool) rows.push(pool);
    if (jacuzzi) rows.push(jacuzzi);
    data.items.forEach(function (item) {
      if (item.service !== "restauration" || item.status !== "Terminée" || item.service === "menage") return;
      rows.push({ label: guestName(item), detail: billLabel(item), amount: eurosOf(item) || 0, offert: !!item.offert, kind: kindOf(item) });
    });
    var due = 0;
    function moneyLine(row) {
      if (!row.offert) due += row.amount;
      var price = '<span class="' + (row.offert ? "is-offert" : "") + '">' + esc(euros(row.amount)) + "</span>";
      var tag = row.offert ? "<small>Offert</small>" : "";
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
    function paintTotal(mode) {
      var paypal = mode === "paypal";
      var grand = due;
      var fee = 0;
      if (paypal) {
        grand = Math.round((due * 1.044 + 0.35) * 100) / 100;
        fee = Math.round((grand - due) * 100) / 100;
      }
      var feeHtml = paypal
        ? '<li class="recap-fee-line"><span>Frais PayPal (4,4\u00A0% + 0,35\u00A0€)</span><b>' + esc(euros(fee)) + "</b></li>"
        : "";
      bill.innerHTML = linesHtml + feeHtml
        + '<li class="recap-sum"><span>Total à régler</span><b><strong>' + esc(euros(grand)) + "</strong><small>soit " + esc(dirhams(grand)) + "</small></b></li>";
      if (feeNode) feeNode.hidden = true;
      if (payBtn) {
        var handle = String(window.PAYPAL_ME || "").replace(/[^A-Za-z0-9]/g, "");
        payBtn.href = handle ? ("https://paypal.me/" + handle + "/" + grand.toFixed(2) + "EUR") : "#";
      }
      if (cashBtn) cashBtn.setAttribute("aria-pressed", paypal ? "false" : "true");
      if (payBtn) payBtn.setAttribute("aria-pressed", paypal ? "true" : "false");
    }
    paintTotal("cash");
    root.querySelectorAll("[data-pay]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        if (button.getAttribute("data-pay") === "paypal" && button.getAttribute("aria-pressed") !== "true") {
          event.preventDefault();
          paintTotal("paypal");
          return;
        }
        if (button.getAttribute("data-pay") === "cash") {
          event.preventDefault();
          paintTotal("cash");
        }
      });
    });
  }

  function boot() {
    var listRoot = document.querySelector("[data-demand-page]");
    var recapRoot = document.querySelector("[data-recap-page]");
    if (!listRoot && !recapRoot) return;
    loadPack().then(function (pack) {
      if (listRoot) paintList(listRoot, pack);
      if (recapRoot) paintRecap(recapRoot, pack);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
