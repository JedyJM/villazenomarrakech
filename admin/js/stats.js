/* Admin Stats. French. Real Sheet data only (no sample figures). */
(function () {
  "use strict";

  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return "test"; } };
  var RATE = 10;
  // Shown under the Séjours stats: tells which admin code the phone runs.
  var BUILD = "2026-11-25 d";
  var STORE = "vz.admin.depenses";
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MONTH_FULL = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  var CATS = {
    salaires: "Salaires",
    citerne: "Citerne",
    jardinier: "Jardinier",
    menage: "Ménage supp.",
    ordures: "Ordures",
    courses: "Courses",
    fournitures: "Fournitures",
    reparations: "Réparations"
  };
  var ICONS = {
    salaires: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a3 3 0 0 1 0 5.74"/>',
    citerne: '<path d="M12 3.2s6 6.1 6 10.2a6 6 0 0 1-12 0c0-4.1 6-10.2 6-10.2z"/>',
    jardinier: '<path d="M12 22V11"/><path d="M12 11c0-4 3-6 6-6-1 4-3 6-6 6z"/><path d="M12 13c0-3-2.5-5-5-5 1 3.2 2.6 5 5 5z"/>',
    menage: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
    ordures: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
    courses: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    fournitures: '<path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/>',
    reparations: '<path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L4 17l3 3 5.1-5.1a4 4 0 0 0 5.6-5.6l-2.2 2.2-2.2-2.2 2.4-2.4z"/>'
  };
  var VIEWS = [["sejours", "Séjours"], ["services", "Services"], ["depenses", "Dépenses"]];
  // Properties in Stats. One unit each. Services and Dépenses are Zen'O only.
  var ZENO = "Villa Zen'O";
  var BIENS = [ZENO, "M avenue", "Villa la tour"];
  var BIEN_FILTERS = [["Tous", "Tous"], [ZENO, "Zen’O"], ["M avenue", "M avenue"], ["Villa la tour", "La tour"]];
  var SOURCES = ["Airbnb", "Booking", "Direct", "Agences", "Famille"];
  var SOURCE_LABELS = { Airbnb: "Airbnb", Booking: "Booking.com", Direct: "Direct", Agences: "Agences", Famille: "Famille" };
  // statsStays: action=stays-stats (all properties), null until loaded.
  // Year of the shared cache feeds (AdminShell.feeds: depenses-<year>).
  var THIS_YEAR = new Date().getFullYear();
  var state = { view: "sejours", year: THIS_YEAR, month: THIS_YEAR + "-12", sMonth: "", bien: "Tous", remoteStays: [], remoteDemandes: [], statsStays: null, loading: 2 };

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function todayIso() {
    if (shell.TEST_MODE) return "2026-12-16";
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoShift(iso, days) {
    var p = String(iso).split("-");
    var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function nights(a, b) {
    var pa = a.split("-");
    var pb = b.split("-");
    var da = Date.UTC(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
    var db = Date.UTC(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
    return Math.round((db - da) / 86400000);
  }
  function yearDays(year) {
    return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  }
  function amountText(cents) {
    var n = Math.round(Number(cents) || 0);
    var neg = n < 0;
    n = Math.abs(n);
    var whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    var frac = n % 100;
    var text = whole;
    if (frac) text += "," + (frac < 10 ? "0" : "") + frac;
    return (neg ? "−" : "") + text;
  }
  function money(cents) { return amountText(cents) + "\u00A0€"; }
  // Stay currency: EUR (default, and Zen'O), MAD (MAD / DH / Dhs), else the code.
  function curOf(stay) {
    var c = String((stay && stay.devise) || "").replace(/[\s.]/g, "").toUpperCase();
    if (!c || c === "EUR" || c === "€") return "EUR";
    if (c === "MAD" || c === "DH" || c === "DHS") return "MAD";
    return c;
  }
  // Amount in its own currency. Never converted.
  function moneyIn(cents, cur) {
    if (!cur || cur === "EUR") return money(cents);
    return amountText(cents) + "\u00A0" + (cur === "MAD" ? "DH" : cur);
  }
  // Currencies of a rollup (or source row), EUR first, then MAD, then others.
  function curList(roll) {
    var keys = Object.keys(roll.cur || {});
    if (!keys.length) return ["EUR"];
    return keys.sort(function (a, b) {
      var ra = a === "EUR" ? 0 : (a === "MAD" ? 1 : 2);
      var rb = b === "EUR" ? 0 : (b === "MAD" ? 1 : 2);
      return ra - rb || (a < b ? -1 : (a > b ? 1 : 0));
    });
  }
  // Everything is in euros (MAD converted at 1 € = 10 DH in apiStay); a
  // currency other than EUR / MAD would still show on its own, never summed.
  function perCur(roll, field, whole) {
    return curList(roll).map(function (c) {
      var v = roll.cur && roll.cur[c] ? roll.cur[c][field] : 0;
      if (whole) v = Math.round((Number(v) || 0) / 100) * 100;
      return moneyIn(v, c);
    }).join(" · ");
  }
  function dayText(iso) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return "";
    return Number(p[2]) + "\u00A0" + MONTHS[Number(p[1]) - 1];
  }
  function icon(name) {
    return '<span class="stat-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.fournitures) + "</svg></span>";
  }
  function readExtra() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{\"items\":[],\"gone\":[]}"); } catch (e) { return { items: [], gone: [] }; }
  }

  function zeros() {
    return { repas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], chauffage: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], massages: 0, transferts: 0, quad: 0, dromadaire: 0 };
  }
  function serviceYear(year) { return servicesFromSheet(year); }
  function euroCents(item) {
    var dh = Number(item.total);
    if (!isFinite(dh) || !dh) return 0;
    return Math.round(dh * 10);
  }
  function serviceBucket(item) {
    if (item.offert || item.status === "Annulée") return "";
    var service = String(item.service || "").toLowerCase();
    var sub = String(item.sous_type || item.extra || item.meal || item.label || "").toLowerCase();
    if (service.indexOf("massage") >= 0 || service.indexOf("soin") >= 0) return "massages";
    if (service.indexOf("transfert") >= 0 || service.indexOf("transfer") >= 0) {
      if (sub.indexOf("ville") >= 0 || sub.indexOf("city") >= 0) return "";
      return "transferts";
    }
    if (service.indexOf("activ") >= 0 || service.indexOf("quad") >= 0 || service.indexOf("dromad") >= 0) {
      if (sub.indexOf("dromad") >= 0 || sub.indexOf("camel") >= 0 || service.indexOf("dromad") >= 0) return "dromadaire";
      if (sub.indexOf("quad") >= 0 || service.indexOf("quad") >= 0) return "quad";
      return "";
    }
    if (service.indexOf("restaur") >= 0 || service.indexOf("petit") >= 0 || service.indexOf("ner") >= 0 || service.indexOf("jeuner") >= 0) return "repas";
    return "";
  }
  function servicesFromSheet(year) {
    var book = zeros();
    (state.remoteDemandes || []).forEach(function (item) {
      var when = String(item.date || "").slice(0, 7);
      if (when.slice(0, 4) !== String(year)) return;
      var bucket = serviceBucket(item);
      if (!bucket) return;
      var cents = euroCents(item);
      var month = Number(when.slice(5, 7)) - 1;
      if (bucket === "repas" && month >= 0 && month < 12) book.repas[month] += cents / 100;
      else if (bucket === "massages") book.massages += cents / 100;
      else if (bucket === "transferts") book.transferts += cents / 100;
      else if (bucket === "quad") book.quad += cents / 100;
      else if (bucket === "dromadaire") book.dromadaire += cents / 100;
    });
    (state.remoteStays || []).forEach(function (stay) {
      var paid = String(stay.encaisse_le || "");
      if (paid.slice(0, 4) !== String(year)) return;
      var off = {};
      var raw = stay.offerts;
      (Array.isArray(raw) ? raw : String(raw || "").split(",")).forEach(function (id) { if (id) off[String(id).trim()] = true; });
      var month = Number(paid.slice(5, 7)) - 1;
      if (month < 0 || month > 11) return;
      if (!off.chauffage_piscine) book.chauffage[month] += ((stay.poolDays || 0) * (stay.poolRate || 0)) / 100;
      if (!off.chauffage_jacuzzi) book.chauffage[month] += ((stay.jacuzziDays || 0) * (stay.jacuzziRate || 0)) / 100;
    });
    return book;
  }
  // Demandes of the year (by service date), from the Sheet only.
  var TYPE_LABELS = [["restauration", "Restauration"], ["menage", "Ménage"], ["transfert", "Transfert"], ["activites", "Activités"], ["massage", "Massages"], ["piscine", "Piscine"]];
  function demandStats(year) {
    var counts = {};
    var total = 0;
    TYPE_LABELS.forEach(function (t) { counts[t[0]] = 0; });
    realOnly(state.remoteDemandes).forEach(function (item) {
      if (String(item.date || item.created || "").slice(0, 4) !== String(year)) return;
      if (item.status === "Annulée") return;
      total += 1;
      var service = String(item.service || "").toLowerCase();
      TYPE_LABELS.forEach(function (t) { if (service.indexOf(t[0]) === 0) counts[t[0]] += 1; });
    });
    return { total: total, delayHours: null, types: TYPE_LABELS.map(function (t) { return [t[1], counts[t[0]]]; }) };
  }
  // Real data only: rows with origine "test" never count in Stats (the
  // « Jeu de test » switch only affects Séjours).
  function realOnly(list) {
    return (list || []).filter(function (row) { return String((row && row.origine) || "").trim().toLowerCase() !== "test"; });
  }

  // All stays for Stats, every year: the stats feed (action=stays-stats),
  // else Zen'O stays from action=stays. Never sample data.
  function allStays() {
    var list = state.statsStays && state.statsStays.length ? state.statsStays : (state.remoteStays || []);
    return realOnly(list);
  }
  function stays() { return allStays(); }
  function mergedExpenses() {
    var base = realOnly(state.remoteExpenses);
    var extra = readExtra();
    var gone = {};
    var map = {};
    (extra.gone || []).forEach(function (id) { gone[id] = true; });
    base.forEach(function (item) { map[item.id] = item; });
    (extra.items || []).forEach(function (item) { map[item.id] = item; });
    var list = [];
    Object.keys(map).forEach(function (id) { if (!gone[id]) list.push(map[id]); });
    return list;
  }
  function expenses() {
    return mergedExpenses().filter(function (item) { return String(item.date || "").slice(0, 4) === String(state.year); });
  }

  function bienOf(stay) { return stay.bien || ZENO; }
  function cancelled(stay) {
    return stay.confirmed === false || /annul|cancel/i.test(String(stay.statut || ""));
  }
  function daysIn(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
  // Period: whole year, or one month ("2026-03"). end is exclusive.
  function periodOf(year, month) {
    if (month) {
      var m = Number(month.slice(5, 7));
      var y = Number(month.slice(0, 4));
      return { start: month + "-01", end: m === 12 ? (y + 1) + "-01-01" : y + "-" + pad(m + 1) + "-01", days: daysIn(y, m) };
    }
    return { start: year + "-01-01", end: (year + 1) + "-01-01", days: yearDays(year) };
  }
  function selection(bien) { return bien === "Tous" || !bien ? BIENS.slice() : [bien]; }
  function emptySource() { return { count: 0, nights: 0, brut: 0, frais: 0, net: 0, cur: {} }; }
  function curBucket(holder, cur) {
    if (!holder.cur[cur]) holder.cur[cur] = { count: 0, nights: 0, brut: 0, frais: 0, net: 0, adr: 0, revpar: 0 };
    return holder.cur[cur];
  }
  // Pure. KPIs of confirmed stays over a period, for the properties in sel.
  // Nights are split across periods (a stay spanning two months counts its
  // nights in each), amounts pro rata of those nights. Future nights in the
  // period count; cancelled stays never (no nights, occupancy or revenue).
  // Stays without departure (Booking stubs) count as bookings / arrivals only.
  // Money is kept per currency in r.cur (EUR, MAD…), never summed across
  // currencies and never converted: r.brut / r.frais / r.net / r.adr /
  // r.revpar are the EUR figures; r.cur.MAD has the dirham ones. ADR per
  // currency = brut / nights of that currency's stays; RevPAR per currency
  // = brut / available nights.
  function rollup(list, period, sel) {
    var inSel = {};
    sel.forEach(function (b) { inSel[b] = true; });
    var by = {};
    SOURCES.forEach(function (k) { by[k] = emptySource(); });
    var r = { by: by, cur: {}, brut: 0, frais: 0, net: 0, nights: 0, count: 0, arrivals: 0, departures: 0, stayNights: 0, staysWithNights: 0, todo: 0, other: 0 };
    list.forEach(function (stay) {
      if (cancelled(stay)) return;
      if (!inSel[bienOf(stay)]) { if (BIENS.indexOf(bienOf(stay)) < 0) r.other += 1; return; }
      var a = String(stay.arrival || "");
      var d = String(stay.departure || "");
      if (!a) return;
      var full = d ? nights(a, d) : 0;
      if (full < 0) full = 0;
      var from = a > period.start ? a : period.start;
      var to = d && d < period.end ? d : period.end;
      var part = full > 0 && from < to ? nights(from, to) : 0;
      var arrives = a >= period.start && a < period.end;
      var leaves = d && d >= period.start && d < period.end;
      if (!part && !arrives) {
        if (leaves) r.departures += 1;
        return;
      }
      var share = full > 0 ? part / full : (arrives ? 1 : 0);
      var brut = Math.round((Number(stay.brut) || 0) * share);
      var frais = Math.round((Number(stay.frais) || 0) * share);
      var net = Math.round((Number(stay.net) || 0) * share);
      var key = sourceKey(stay.source);
      var cur = curOf(stay);
      r.count += 1;
      if (arrives) r.arrivals += 1;
      if (leaves) r.departures += 1;
      if (full > 0) { r.stayNights += full; r.staysWithNights += 1; }
      if (stay.a_completer) r.todo += 1;
      r.nights += part;
      by[key].count += 1;
      by[key].nights += part;
      // A stub with no amount and no night (Booking à compléter) opens no currency.
      if (!brut && !frais && !net && !part && !stay.devise) return;
      [curBucket(r, cur), curBucket(by[key], cur)].forEach(function (b) {
        b.count += 1;
        b.nights += part;
        b.brut += brut;
        b.frais += frais;
        b.net += net;
      });
    });
    r.units = sel.length;
    r.days = period.days;
    r.available = period.days * sel.length;
    r.occupancy = r.available ? r.nights / r.available : 0;
    r.rate = Math.round(r.occupancy * 100);
    Object.keys(r.cur).forEach(function (c) {
      var b = r.cur[c];
      b.adr = b.nights ? Math.round(b.brut / b.nights) : 0;
      b.revpar = r.available ? Math.round(b.brut / r.available) : 0;
    });
    SOURCES.forEach(function (k) {
      var e = by[k].cur.EUR || emptySource();
      by[k].brut = e.brut;
      by[k].frais = e.frais;
      by[k].net = e.net;
    });
    var eur = r.cur.EUR || { brut: 0, frais: 0, net: 0, adr: 0, revpar: 0 };
    r.brut = eur.brut;
    r.frais = eur.frais;
    r.net = eur.net;
    r.adr = eur.adr;
    r.revpar = eur.revpar;
    r.avgStay = r.staysWithNights ? Math.round(r.stayNights / r.staysWithNights * 10) / 10 : 0;
    r.avg = Math.round(r.avgStay);
    return r;
  }
  // Zen'O year rollup for Services (panier) and Dépenses (marge).
  function stayRollup(list) { return rollup(list, periodOf(state.year, ""), [ZENO]); }
  // agency: agence_nom, read too so "Autre agence" + "Famille" lands in Famille.
  function sourceKey(source, agency) {
    var s = String(source || "").toLowerCase();
    if (/famil/.test(s + " " + String(agency || "").toLowerCase())) return "Famille"; // « Autre : famille »
    if (s.indexOf("airbnb") >= 0) return "Airbnb";
    if (s.indexOf("booking") >= 0) return "Booking";
    if (!s || s === "direct") return "Direct";
    return "Agences"; // Villanovo, Marrakech Best Of, Autre agence…
  }

  function tile(kicker, value, sub, subClass) {
    return '<article class="stat-tile"><p class="kicker">' + esc(kicker) + '</p><strong>' + value + "</strong>" + (sub ? '<em class="' + (subClass || "") + '">' + sub + "</em>" : "") + "</article>";
  }
  // Whole euros, for the dense tables.
  function euros(cents) { return money(Math.round((Number(cents) || 0) / 100) * 100); }
  function pct(roll) { return roll.rate + " %"; }
  function plural(n, word) { return n + " " + word + (n > 1 ? "s" : ""); }
  function sourceCard(roll) {
    return '<section class="block stat-source"><p class="kicker">Par source</p>' + SOURCES.map(function (name) {
      var row = roll.by[name];
      var main = row.cur[curList(row)[0]] || row;
      var width = main.brut > 0 ? Math.round(main.frais / main.brut * 100) : 0;
      return '<div class="src"><p class="src-top"><span>' + esc(SOURCE_LABELS[name]) + '</span><em>' + esc(plural(row.count, "séjour") + " · " + plural(row.nights, "nuit")) + "</em></p>"
        + '<span class="src-bar" aria-hidden="true"><i style="width:' + width + '%"></i></span>'
        + '<p class="src-nums"><span><small>Brut</small>' + esc(perCur(row, "brut")) + '</span><span><small>Frais</small>' + esc(perCur(row, "frais")) + '</span><span><small>Net</small>' + esc(perCur(row, "net")) + "</span></p></div>";
    }).join("") + "</section>";
  }
  function bienCard(list, period) {
    var rows = BIENS.map(function (bien) {
      var r = rollup(list, period, [bien]);
      return "<tr><th>" + esc(bien) + "</th><td>" + r.nights + "</td><td>" + esc(pct(r)) + "</td><td>" + esc(perCur(r, "adr", true)) + "</td><td>" + esc(perCur(r, "brut", true)) + "</td><td>" + esc(perCur(r, "net", true)) + "</td></tr>";
    }).join("");
    return '<section class="block stat-table"><p class="kicker">Par bien</p><table><thead><tr><th></th><th>Nuits</th><th>Occ.</th><th>ADR</th><th>Brut</th><th>Net</th></tr></thead><tbody>' + rows + "</tbody></table></section>";
  }
  function monthCard(list, sel) {
    var rows = MONTHS.map(function (name, index) {
      var id = state.year + "-" + pad(index + 1);
      var r = rollup(list, periodOf(state.year, id), sel);
      return '<tr data-smonth="' + id + '"><th>' + esc(name) + "</th><td>" + r.nights + "</td><td>" + esc(pct(r)) + "</td><td>" + esc(perCur(r, "adr", true)) + "</td><td>" + esc(perCur(r, "revpar", true)) + "</td><td>" + r.count + "</td><td>" + esc(perCur(r, "brut", true)) + "</td><td>" + esc(perCur(r, "net", true)) + "</td></tr>";
    }).join("");
    return '<section class="block stat-table"><p class="kicker">Par mois</p><table><thead><tr><th></th><th>Nuits</th><th>Occ.</th><th>ADR</th><th>RevPAR</th><th>Séj.</th><th>Brut</th><th>Net</th></tr></thead><tbody>' + rows + "</tbody></table></section>";
  }
  function bienSegment() {
    return '<div class="segment is-4" role="group" aria-label="Bien">' + BIEN_FILTERS.map(function (item) {
      var on = item[0] === state.bien;
      return '<button type="button" data-bien="' + esc(item[0]) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(item[1]) + "</button>";
    }).join("") + "</div>";
  }
  // Shown instead of a panel while nothing real has come back.
  function emptyHtml() {
    if (state.loading) return '<p class="empty" data-no-data>Chargement des données…</p>';
    return '<p class="empty" data-no-data>Aucune donnée réelle</p>';
  }
  function sejoursHtml() {
    var list = stays();
    if (!list.length) return emptyHtml();
    var sel = selection(state.bien);
    var period = periodOf(state.year, state.sMonth);
    var roll = rollup(list, period, sel);
    var avail = roll.nights + " nuits / " + roll.available + (roll.units > 1 ? " (" + roll.units + " biens)" : "");
    var notes = [];
    if (roll.todo) notes.push(plural(roll.todo, "séjour") + " Booking à compléter (montants ou départ manquants).");
    var zenoList = list.filter(function (st) { return st.bien === ZENO && !cancelled(st); });
    var absent = zenoList.filter(function (st) { return st.brutSource === "absent"; }).length;
    // Direct / agences: tarif is what the guest pays; Booking: montant. Only
    // Airbnb differs (room − reduction leaves out the guest fees).
    var vide = zenoList.filter(function (st) { return st.brutSource === "vide" && st.source === "Airbnb"; }).length;
    var warn = "";
    if (absent && (state.bien === "Tous" || state.bien === ZENO)) warn = "Brut Zen’O provisoire (chambre − réduction) : le script Apps Script en ligne n’envoie pas total_voyageur. À republier, puis Actualiser.";
    else if (vide && (state.bien === "Tous" || state.bien === ZENO)) notes.push(plural(vide, "séjour") + " Airbnb Zen’O sans total_voyageur dans le Sheet : brut = chambre − réduction pour ce" + (vide > 1 ? "s" : "") + " séjour" + (vide > 1 ? "s" : "") + ".");
    if (roll.other && state.bien === "Tous") notes.push(plural(roll.other, "séjour") + " d’un bien inconnu non compté" + (roll.other > 1 ? "s" : "") + ".");
    return bienSegment()
      + (warn ? '<p class="stat-warn" role="status">' + esc(warn) + "</p>" : "")
      + '<div class="stat-3">' + tile("Brut", esc(perCur(roll, "brut"))) + tile("Frais plateformes", esc(perCur(roll, "frais"))) + tile("Net (versé)", esc(perCur(roll, "net"))) + "</div>"
      + '<div class="stat-3">' + tile("Occupation", esc(pct(roll)), esc(avail), "is-detail") + tile("ADR", esc(perCur(roll, "adr")), "brut / nuit") + tile("RevPAR", esc(perCur(roll, "revpar")), "brut / nuit dispo.") + "</div>"
      + '<div class="stat-3">' + tile("Séjours", esc(String(roll.count)), esc("moy. " + String(roll.avgStay).replace(".", ",") + " nuits")) + tile("Arrivées", esc(String(roll.arrivals))) + tile("Départs", esc(String(roll.departures))) + "</div>"
      + sourceCard(roll)
      + (sel.length > 1 ? bienCard(list, period) : "")
      + (state.sMonth ? "" : monthCard(list, sel))
      + (notes.length ? '<p class="stat-note">' + esc(notes.join(" ")) + "</p>" : "")
      + '<p class="stat-note">Nuits réparties par mois, futures comprises ; séjours annulés exclus. Tous les montants en euros ; dirhams convertis à 1\u00A0€ = 10\u00A0DH. Occupation = nuits / (jours × biens). ADR = brut / nuits, RevPAR = brut / nuits disponibles. Brut = total payé par le voyageur (total_voyageur) ; à défaut, frais de chambre − réduction (Airbnb), montant (Booking), tarif (direct). Frais plateformes = brut − net versé (Airbnb : frais voyageur et hôte), commission + frais bancaires (Booking). La taxe de séjour Booking est encaissée à part et n’entre pas dans le net. Version admin ' + esc(BUILD) + ".</p>";
  }
  function serviceSums(book) {
    var repas = book.repas.reduce(function (s, n) { return s + n; }, 0);
    var heat = book.chauffage.reduce(function (s, n) { return s + n; }, 0);
    var activites = (book.quad || 0) + (book.dromadaire || 0);
    var total = repas + heat + (book.massages || 0) + (book.transferts || 0) + activites;
    return { repas: repas, heat: heat, massages: book.massages || 0, transferts: book.transferts || 0, quad: book.quad || 0, dromadaire: book.dromadaire || 0, activites: activites, total: total };
  }
  function servicesHtml() {
    if (!stays().length && !realOnly(state.remoteDemandes).length) return emptyHtml();
    var book = serviceYear(state.year);
    var sums = serviceSums(book);
    var repas = sums.repas;
    var heat = sums.heat;
    var total = sums.total;
    var roll = stayRollup(stays());
    var demands = demandStats(state.year);
    var basket = roll.count ? Math.round(total / roll.count) : 0;
    var perStay = roll.count ? Math.round(demands.total / roll.count * 10) / 10 : 0;
    var perText = String(perStay).replace(".", ",");
    var max = 0;
    book.repas.forEach(function (n, i) { max = Math.max(max, n, book.chauffage[i]); });
    if (!max) max = 1;
    var bars = book.repas.map(function (n, i) {
      var h1 = Math.round(n / max * 100);
      var h2 = Math.round(book.chauffage[i] / max * 100);
      return '<span class="chart-col"><i><b style="height:' + h1 + '%"></b><b class="is-gold" style="height:' + h2 + '%"></b></i><em>' + LETTERS[i] + "</em></span>";
    }).join("");
    var maxType = 0;
    demands.types.forEach(function (row) { if (row[1] > maxType) maxType = row[1]; });
    if (!maxType) maxType = 1;
    var types = demands.types.map(function (row) {
      return '<p class="type-row"><span>' + esc(row[0]) + '</span><i><b style="width:' + Math.round(row[1] / maxType * 100) + '%"></b></i><em>' + row[1] + "</em></p>";
    }).join("");
    var actSub = "Quad " + money(sums.quad * 100) + " · Dromad. " + money(sums.dromadaire * 100);
    return '<div class="stat-3">' + tile("Repas", esc(money(repas * 100))) + tile("Chauffage", esc(money(heat * 100))) + tile("Massages & soins", esc(money(sums.massages * 100))) + "</div>"
      + '<div class="stat-3">' + tile("Transferts aéroport", esc(money(sums.transferts * 100))) + tile("Activités", esc(money(sums.activites * 100)), esc(actSub), "is-detail") + tile("Total services", esc(money(total * 100))) + "</div>"
      + '<section class="block stat-chart"><p class="chart-legend"><span><i></i>Repas</span><span><i class="is-gold"></i>Chauffage</span></p><div class="chart">' + bars + "</div></section>"
      + '<div class="stat-3">' + tile("Panier moyen", esc(money(basket * 100)), "par séjour") + tile("Demandes / séjour", esc(perText), esc(demands.total + " au total")) + tile("Délai confirmation", demands.delayHours == null ? "—" : esc(demands.delayHours + "\u00A0h"), "moyenne") + "</div>"
      + '<section class="block"><p class="kicker">Demandes par type</p>' + types + "</section>"
      + '<p class="stat-note">Services\u00A0: Villa Zen’O uniquement. Le taux d’occupation se trouve dans l’onglet Séjours. Coûts\u00A0: onglet Dépenses.</p>';
  }
  function expenseTitle(item) {
    var name = CATS[item.categorie] || item.categorie || "Dépense";
    return item.detail ? name + " · " + item.detail : name;
  }
  function depensesHtml() {
    var all = expenses();
    if (!all.length && !stays().length) return emptyHtml();
    var monthItems = all.filter(function (item) { return String(item.date).slice(0, 7) === state.month; });
    monthItems.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var monthEur = monthItems.reduce(function (sum, item) { return sum + Math.round(item.montant_eur * 100); }, 0);
    var roll = stayRollup(stays());
    var services = serviceSums(serviceYear(state.year)).total * 100;
    var spent = all.reduce(function (sum, item) { return sum + Math.round(item.montant_eur * 100); }, 0);
    var marge = roll.net + services - spent;
    var rows = monthItems.map(function (item) {
      var facture = item.facture_url
        ? '<button type="button" class="bill-link is-on" data-facture="' + esc(item.id) + '">Facture jointe</button>'
        : '<span class="bill-link">Sans facture</span>';
      return '<a class="exp" href="depense.html?id=' + encodeURIComponent(item.id) + '">' + icon(item.categorie)
        + '<span class="exp-title">' + esc(expenseTitle(item)) + '</span>'
        + '<span class="exp-sub">' + esc(dayText(item.date)) + "</span>"
        + '<b>' + esc(money(Math.round(item.montant_eur * 100))) + "</b>" + facture + "</a>";
    }).join("");
    return '<div class="stat-2">' + tile("Dépenses du mois", esc(money(monthEur)), esc(monthItems.length + " écriture" + (monthItems.length > 1 ? "s" : "")))
      + tile("Marge " + state.year, esc(money(marge)), "Net séjours + services − dépenses") + "</div>"
      + '<section class="block exp-list">' + (rows || '<p class="empty">Aucune dépense ce mois.</p>') + "</section>";
  }

  function tools() {
    if (state.view === "depenses") {
      var parts = state.month.split("-");
      var label = MONTH_FULL[Number(parts[1]) - 1] + " " + parts[0];
      label = label.charAt(0).toUpperCase() + label.slice(1);
      return '<button type="button" class="period" data-open-period>' + esc(label) + '</button><a class="add-link" href="depense.html?mois=' + esc(state.month) + '">+ Ajouter</a>';
    }
    if (state.view === "services") return "";
    if (state.sMonth) {
      var m = MONTH_FULL[Number(state.sMonth.slice(5, 7)) - 1];
      return '<button type="button" class="period" data-open-period>' + esc(m.charAt(0).toUpperCase() + m.slice(1) + " " + state.year) + "</button>";
    }
    return '<button type="button" class="period" data-open-period>Année ' + state.year + "</button>";
  }
  function panel() {
    if (state.view === "services") return servicesHtml();
    if (state.view === "depenses") return depensesHtml();
    return sejoursHtml();
  }
  var REFRESH_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/></svg>';
  function syncLine() {
    var text = state.refreshing ? "Mise à jour…" : (shell.stampText ? shell.stampText(state.at) : "");
    return '<p class="sync"><span data-stamp>' + esc(text) + '</span><button type="button" data-refresh' + (state.refreshing ? " disabled" : "") + ">Actualiser</button></p>";
  }
  function paint() {
    var root = document.querySelector("[data-stats]");
    root.innerHTML = '<div class="stats-top"><h1>Stats</h1><div class="stats-tools">' + tools()
      + '<button type="button" class="refresh-ico" data-refresh aria-label="Actualiser les données"' + (state.refreshing ? " disabled" : "") + ">" + REFRESH_ICO + "</button></div></div>"
      + '<div class="segment" role="group" aria-label="Vue">' + VIEWS.map(function (item) {
        var on = item[0] === state.view;
        return '<button type="button" data-view="' + item[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + item[1] + "</button>";
      }).join("") + "</div>"
      + '<div class="stats-panel">' + panel() + "</div>"
      + syncLine();
  }
  function openPeriod() {
    var sheet = document.querySelector("[data-sheet]");
    var html = "";
    if (state.view === "depenses") {
      html = '<p class="kicker">Mois</p>' + MONTH_FULL.map(function (name, index) {
        var id = state.year + "-" + pad(index + 1);
        return '<button type="button" class="statut-choice' + (id === state.month ? " is-current" : "") + '" data-month="' + id + '">' + esc(name.charAt(0).toUpperCase() + name.slice(1)) + "</button>";
      }).join("");
    } else {
      html = '<p class="kicker">Année</p>' + [2027, 2026, 2025, 2024].map(function (year) {
        return '<button type="button" class="statut-choice' + (year === state.year && !state.sMonth ? " is-current" : "") + '" data-year="' + year + '">Année ' + year + "</button>";
      }).join("");
      if (state.view === "sejours") {
        html += '<p class="kicker">Mois ' + state.year + '</p><div class="period-months">' + MONTHS.map(function (name, index) {
          var id = state.year + "-" + pad(index + 1);
          return '<button type="button" class="statut-choice' + (id === state.sMonth ? " is-current" : "") + '" data-smonth="' + id + '">' + esc(name) + "</button>";
        }).join("") + "</div>";
      }
    }
    html += '<button type="button" class="ghost" data-sheet-close>Fermer</button>';
    sheet.innerHTML = html;
    sheet.hidden = false;
    document.querySelector("[data-sheet-back]").hidden = false;
  }
  function closeSheet() {
    document.querySelector("[data-sheet]").hidden = true;
    document.querySelector("[data-sheet-back]").hidden = true;
  }
  function showPhoto(id) {
    var found = null;
    expenses().forEach(function (item) { if (item.id === id) found = item; });
    if (!found || !found.facture_url) return;
    document.querySelector("[data-photo-img]").src = found.facture_url;
    document.querySelector("[data-photo]").hidden = false;
  }
  function boot() {
    var root = document.querySelector("[data-stats]");
    if (!root || document.body.classList.contains("is-locked")) return;
    var asked = query("vue");
    var askedBien = query("bien");
    BIEN_FILTERS.forEach(function (item) { if (item[0] === askedBien) state.bien = askedBien; });
    if (asked === "services" || asked === "depenses" || asked === "sejours") state.view = asked;
    root.addEventListener("click", function (event) {
      var view = event.target.closest("[data-view]");
      if (view) { state.view = view.getAttribute("data-view"); paint(); return; }
      var bien = event.target.closest("[data-bien]");
      if (bien) { state.bien = bien.getAttribute("data-bien"); paint(); return; }
      var row = event.target.closest("tr[data-smonth]");
      if (row) { state.sMonth = row.getAttribute("data-smonth"); paint(); return; }
      if (event.target.closest("[data-open-period]")) { openPeriod(); return; }
      if (event.target.closest("[data-refresh]")) { if (!state.refreshing) refresh(); return; }
      var facture = event.target.closest("[data-facture]");
      if (facture) { event.preventDefault(); showPhoto(facture.getAttribute("data-facture")); }
    });
    document.addEventListener("click", function (event) {
      var year = event.target.closest("[data-year]");
      if (year) { state.year = Number(year.getAttribute("data-year")); state.month = state.year + "-12"; state.sMonth = ""; closeSheet(); paint(); return; }
      var smonth = event.target.closest(".period-months [data-smonth]");
      if (smonth) { state.sMonth = smonth.getAttribute("data-smonth"); closeSheet(); paint(); return; }
      var month = event.target.closest("[data-month]");
      if (month) { state.month = month.getAttribute("data-month"); closeSheet(); paint(); return; }
      if (event.target.closest("[data-sheet-close]") || event.target.hasAttribute("data-sheet-back")) closeSheet();
      if (event.target.closest("[data-photo-close]") || event.target.hasAttribute("data-photo")) document.querySelector("[data-photo]").hidden = true;
    });
    paint();
    load(false);
  }
  /* Data from the daily cache (AdminShell.cachedGet): four feeds, shown at
     once from the cache, refreshed over the network once a day or on
     « Actualiser ». stays-stats = all properties (also in TEST_MODE so the
     preview shows imported data); stays = Zen'O portal stays (services
     chauffage, fallback); demandes; dépenses of the year. */
  var FEEDS = [
    ["stays-stats", function () { return "action=stays-stats"; }, function (data) { if (data && data.ok && data.stays) state.statsStays = data.stays.map(apiStay); }],
    ["stays", function () { return "action=stays"; }, function (data) { if (data && data.ok) state.remoteStays = (data.stays || []).map(apiStay); }],
    ["demandes", function () { return "action=demandes"; }, function (data) { if (data && data.ok) state.remoteDemandes = data.items || []; }],
    ["depenses-" + state.year, function () { return "action=depenses&year=" + state.year; }, function (data) { if (data && data.ok) state.remoteExpenses = data.depenses || []; }]
  ];
  // Zen'O rows must carry totalVoyageur: a cached answer without it (older
  // script) is refetched instead of reused.
  function hasTotals(data) {
    var list = (data && data.stays) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].portal !== false && !("totalVoyageur" in list[i])) return false;
    return true;
  }
  function load(force) {
    if (!shell.cachedGet) { state.loading = 0; paint(); return; }
    state.loading = FEEDS.length;
    var first = {};
    FEEDS.forEach(function (feed) {
      shell.cachedGet(feed[0], feed[1](), function (data, meta) {
        feed[2](data);
        if (meta && meta.at) stampFeed(feed[0], meta.at);
        if (!first[feed[0]]) { first[feed[0]] = true; state.loading = Math.max(0, state.loading - 1); }
        paint();
      }, { force: force, valid: feed[0].indexOf("stays") === 0 ? hasTotals : null });
    });
  }
  // Oldest update among the feeds (what the stamp shows).
  function stampFeed(name, at) {
    state.ats = state.ats || {};
    state.ats[name] = at;
    var list = Object.keys(state.ats).map(function (k) { return state.ats[k]; });
    state.at = Math.min.apply(Math, list);
  }
  function refresh() {
    state.refreshing = true;
    paint();
    var left = FEEDS.length;
    FEEDS.forEach(function (feed) {
      shell.cachedGet(feed[0], feed[1](), function (data, meta) {
        feed[2](data);
        if (meta && meta.at) stampFeed(feed[0], meta.at);
        left -= 1;
        if (!left) state.refreshing = false;
        paint();
      }, { force: true, valid: feed[0].indexOf("stays") === 0 ? hasTotals : null });
    });
  }
  function apiStay(stay) {
    var source = sourceKey(stay.source, stay.agency);
    var kind = sourceKey(stay.source);
    var brut = 0;
    var frais = 0;
    var net = 0;
    if (stay.portal === false) {
      brut = stay.brut || 0;
      frais = stay.frais || 0;
      net = stay.net != null ? stay.net : brut - frais;
    } else if (kind === "Airbnb") {
      net = (stay.room || 0) - (stay.reduction || 0) - (stay.hostFee || 0);
      brut = (stay.room || 0) - (stay.reduction || 0);
      frais = stay.hostFee || 0;
    } else if (kind === "Booking") {
      brut = stay.total || 0;
      frais = (stay.commission || 0) + (stay.bank || 0);
      net = brut - frais;
    } else {
      brut = stay.tarif || 0;
      net = brut;
    }
    // Brut = what the guest paid (total_voyageur, cents) when the Sheet has
    // it. Net (payout) is unchanged; frais = brut - net keeps them coherent.
    if (stay.portal !== false && Number(stay.totalVoyageur) > 0) {
      brut = Number(stay.totalVoyageur);
      frais = brut - net;
    }
    // Stats are in euros only: dirham amounts (La tour, MAD / DH / Dhs)
    // are converted at 1 € = 10 DH. Cents stay integers.
    var devise = stay.devise ? curOf(stay) : "";
    if (devise === "MAD") {
      brut = Math.round((Number(brut) || 0) / RATE);
      frais = Math.round((Number(frais) || 0) / RATE);
      net = Math.round((Number(net) || 0) / RATE);
      devise = "EUR";
    }
    return {
      source: source, arrival: stay.arrival, departure: stay.departure, brut: brut, frais: frais, net: net,
      bien: stay.portal === false ? String(stay.bien || "Autre") : ZENO, devise: devise,
      // Zen'O brut check: the live script sends totalVoyageur (0 when the
      // Sheet cell is empty); an older deployment does not send it at all.
      brutSource: stay.portal === false ? "" : (!("totalVoyageur" in stay) ? "absent" : (Number(stay.totalVoyageur) > 0 ? "total" : "vide")), statut: stay.statut || "", a_completer: stay.a_completer || "", confirmed: true,
      poolDays: stay.poolDays || 0, poolRate: stay.poolRate || 0, jacuzziDays: stay.jacuzziDays || 0, jacuzziRate: stay.jacuzziRate || 0,
      encaisse_le: stay.encaisse_le || "", offerts: stay.offerts || "", origine: String(stay.origine || "")
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.AdminStats = {
    CATS: CATS,
    RATE: RATE,
    all: mergedExpenses,
    readExtra: readExtra,
    saveExtra: function (bag) { try { localStorage.setItem(STORE, JSON.stringify(bag)); } catch (e) {} },
    money: money,
    todayIso: todayIso,
    rollup: rollup,
    periodOf: periodOf,
    selection: selection,
    sourceKey: sourceKey,
    apiStay: apiStay,
    curOf: curOf,
    moneyIn: moneyIn
  };
})();
