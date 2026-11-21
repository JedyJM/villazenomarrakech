/* Admin Stats. French. Test figures match the approved screen. */
(function () {
  "use strict";

  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return "test"; } };
  var RATE = 10;
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
  var state = { view: "sejours", year: 2026, month: "2026-12" };

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
  function money(cents) {
    var n = Math.round(Number(cents) || 0);
    var neg = n < 0;
    n = Math.abs(n);
    var whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    var frac = n % 100;
    var text = whole;
    if (frac) text += "," + (frac < 10 ? "0" : "") + frac;
    return (neg ? "−" : "") + text + "\u00A0€";
  }
  function dirhams(cents) {
    var n = Math.round((Number(cents) || 0) * RATE);
    var neg = n < 0;
    n = Math.abs(n);
    var whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    var frac = n % 100;
    var text = whole;
    if (frac) text += "," + (frac < 10 ? "0" : "") + frac;
    return (neg ? "−" : "") + text + "\u00A0DH";
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

  function planStays(year, plan) {
    var list = [];
    var cursor = year + "-01-08";
    var n = 0;
    plan.forEach(function (row) {
      var i;
      for (i = 0; i < row[1]; i++) {
        var arrival = cursor;
        var departure = isoShift(arrival, 7);
        list.push({
          id: "s" + year + n,
          source: row[0],
          arrival: arrival,
          departure: departure,
          brut: row[2],
          frais: row[3],
          net: row[4],
          confirmed: true
        });
        cursor = isoShift(cursor, 18);
        n += 1;
      }
    });
    return list;
  }
  function sampleStays(year) {
    if (year === 2026) {
      return planStays(2026, [
        ["Airbnb", 8, 525000, 75000, 450000],
        ["Booking", 4, 525000, 100000, 425000],
        ["Direct", 3, 400000, 0, 400000]
      ]);
    }
    if (year === 2025) {
      return planStays(2025, [
        ["Airbnb", 4, 480000, 70000, 410000],
        ["Booking", 2, 500000, 90000, 410000],
        ["Direct", 2, 380000, 0, 380000]
      ]);
    }
    return [];
  }
  function serviceYear(year) {
    if (year === 2026) {
      return {
        repas: [180, 100, 140, 160, 200, 220, 240, 260, 220, 200, 240, 240],
        chauffage: [200, 180, 120, 40, 0, 0, 0, 0, 0, 60, 280, 320],
        surplace: 360
      };
    }
    if (year === 2025) {
      return {
        repas: [80, 60, 70, 80, 90, 100, 110, 120, 90, 80, 70, 80],
        chauffage: [120, 100, 60, 20, 0, 0, 0, 0, 0, 30, 140, 160],
        surplace: 180
      };
    }
    return { repas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], chauffage: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], surplace: 0 };
  }
  function demandStats(year) {
    if (year === 2026) {
      return { total: 48, delayHours: 3, types: [["Restauration", 18], ["Ménage", 9], ["Transfert", 8], ["Activités", 6], ["Massages", 4], ["Piscine", 3]] };
    }
    if (year === 2025) {
      return { total: 30, delayHours: 4, types: [["Restauration", 12], ["Ménage", 6], ["Transfert", 5], ["Activités", 3], ["Massages", 2], ["Piscine", 2]] };
    }
    return { total: 0, delayHours: null, types: [["Restauration", 0], ["Ménage", 0], ["Transfert", 0], ["Activités", 0], ["Massages", 0], ["Piscine", 0]] };
  }
  function sampleExpenses() {
    var photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABgCAYAAAC+EjQcAAAAwElEQVR42u3dsQnAIBQEUCfKAtnIYTJFRslGdjba2gghiMXPK26Bhweejek6jybzJAgvgVotMgQQIECAAAH6GdCKewUgQIAAAQIEyD0IUCCg585hA2gHkIoBAgQIECBAgAABEkCAAAHyHuS5Q8UAAQIECBAgQIAAAQIECJA1b82rGCBAgAAJIECAAAECBAiQNe8EqRggQIAAAQIECBAgQIAAWfPWvIoBEkCAAAECBAgQIECAAAECBAhQHCDxO9SndJhydoh0h0qcAAAAAElFTkSuQmCC";
    function row(id, date, cat, detail, who, eur, facture, name) {
      return {
        id: id, date: date, categorie: cat, detail: detail || "", fournisseur: who || "",
        montant_eur: eur, montant_dh: eur * RATE, devise_saisie: "eur",
        facture_url: facture ? photo : "", facture_nom: facture ? (name || "facture.jpg") : "", cree_le: date
      };
    }
    var list = [
      row("d1", "2026-12-02", "salaires", "", "Fouzia", 800, true, "salaire-fouzia.jpg"),
      row("d2", "2026-12-02", "salaires", "", "Nadera", 400, true, "salaire-nadera.jpg"),
      row("d3", "2026-12-05", "citerne", "", "", 180, false),
      row("d4", "2026-12-08", "jardinier", "", "Hassan", 120, true, "jardinier.jpg"),
      row("d5", "2026-12-11", "courses", "", "Atacadao", 85, false),
      row("d6", "2026-12-14", "ordures", "", "", 36, false),
      row("d7", "2026-12-15", "reparations", "plombier", "Karim", 50, true, "plombier.jpg")
    ];
    var salaries = [2525, 2525, 2525, 2525, 2525, 2525, 2525, 2525, 2525, 2525, 2519];
    salaries.forEach(function (eur, index) {
      var month = index + 1;
      list.push(row("y" + month, "2026-" + pad(month) + "-28", "salaires", "", "", eur, false));
    });
    return list;
  }

  function stays() { return shell.TEST_MODE ? sampleStays(state.year) : (state.remoteStays || []); }
  function mergedExpenses() {
    var base = shell.TEST_MODE ? sampleExpenses() : (state.remoteExpenses || []);
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

  function stayRollup(list) {
    var today = todayIso();
    var by = { Airbnb: emptySource(), Booking: emptySource(), Direct: emptySource() };
    var nightsSum = 0;
    var count = 0;
    list.forEach(function (stay) {
      if (stay.confirmed === false) return;
      if (String(stay.departure) > today) return;
      if (String(stay.arrival).slice(0, 4) !== String(state.year) && String(stay.departure).slice(0, 4) !== String(state.year)) return;
      var n = nights(stay.arrival, stay.departure);
      if (n < 1) return;
      var key = stay.source === "Booking" ? "Booking" : stay.source === "Direct" ? "Direct" : "Airbnb";
      by[key].count += 1;
      by[key].nights += n;
      by[key].brut += stay.brut;
      by[key].frais += stay.frais;
      by[key].net += stay.net;
      nightsSum += n;
      count += 1;
    });
    var brut = 0;
    var frais = 0;
    var net = 0;
    ["Airbnb", "Booking", "Direct"].forEach(function (key) {
      brut += by[key].brut;
      frais += by[key].frais;
      net += by[key].net;
    });
    var days = yearDays(state.year);
    return { by: by, brut: brut, frais: frais, net: net, nights: nightsSum, count: count, days: days, rate: days ? Math.round(nightsSum / days * 100) : 0, avg: count ? Math.round(nightsSum / count) : 0 };
  }
  function emptySource() { return { count: 0, nights: 0, brut: 0, frais: 0, net: 0 }; }

  function tile(kicker, value, sub) {
    return '<article class="stat-tile"><p class="kicker">' + esc(kicker) + '</p><strong>' + value + "</strong>" + (sub ? "<em>" + sub + "</em>" : "") + "</article>";
  }
  function sourceCard(roll) {
    return '<section class="block stat-source"><p class="kicker">Par source</p>' + ["Airbnb", "Booking", "Direct"].map(function (name) {
      var row = roll.by[name];
      var width = row.brut > 0 ? Math.round(row.frais / row.brut * 100) : 0;
      return '<div class="src"><p class="src-top"><span>' + esc(name) + '</span><em>' + row.count + " séjour" + (row.count > 1 ? "s" : "") + "</em></p>"
        + '<span class="src-bar" aria-hidden="true"><i style="width:' + width + '%"></i></span>'
        + '<p class="src-nums"><span><small>Brut</small>' + esc(money(row.brut)) + '</span><span><small>Frais</small>' + esc(money(row.frais)) + '</span><span><small>Net</small>' + esc(money(row.net)) + "</span></p></div>";
    }).join("") + "</section>";
  }
  function sejoursHtml() {
    var roll = stayRollup(stays());
    return '<div class="stat-3">' + tile("Brut", esc(money(roll.brut))) + tile("Frais plateformes", esc(money(roll.frais))) + tile("Net", esc(money(roll.net))) + "</div>"
      + '<div class="stat-2">' + tile("Taux d’occupation", esc(roll.rate + "\u00A0%"), esc(roll.nights + " nuits / " + roll.days)) + tile("Séjours", esc(String(roll.count)), esc("moy. " + roll.avg + " nuits")) + "</div>"
      + sourceCard(roll)
      + '<p class="stat-note">Frais plateformes = frais de service hôte (Airbnb) et commission + frais bancaires (Booking). La taxe de séjour Booking est encaissée à part et n’entre pas dans le net.</p>';
  }
  function servicesHtml() {
    var book = serviceYear(state.year);
    var repas = book.repas.reduce(function (s, n) { return s + n; }, 0);
    var heat = book.chauffage.reduce(function (s, n) { return s + n; }, 0);
    var total = repas + heat + book.surplace;
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
    return '<div class="stat-3">' + tile("Repas", esc(money(repas * 100))) + tile("Chauffage", esc(money(heat * 100))) + tile("Sur place", esc(money(book.surplace * 100))) + "</div>"
      + '<section class="block stat-chart"><p class="chart-legend"><span><i></i>Repas</span><span><i class="is-gold"></i>Chauffage</span></p><div class="chart">' + bars + "</div></section>"
      + '<div class="stat-3">' + tile("Panier moyen", esc(money(basket * 100)), "par séjour") + tile("Demandes / séjour", esc(perText), esc(demands.total + " au total")) + tile("Délai confirmation", demands.delayHours == null ? "—" : esc(demands.delayHours + "\u00A0h"), "moyenne") + "</div>"
      + '<section class="block"><p class="kicker">Demandes par type</p>' + types + "</section>"
      + '<p class="stat-note">Le taux d’occupation se trouve dans l’onglet Séjours. Coûts\u00A0: onglet Dépenses.</p>';
  }
  function expenseTitle(item) {
    var name = CATS[item.categorie] || item.categorie || "Dépense";
    return item.detail ? name + " · " + item.detail : name;
  }
  function depensesHtml() {
    var all = expenses();
    var monthItems = all.filter(function (item) { return String(item.date).slice(0, 7) === state.month; });
    monthItems.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var monthEur = monthItems.reduce(function (sum, item) { return sum + Math.round(item.montant_eur * 100); }, 0);
    var roll = stayRollup(stays());
    var book = serviceYear(state.year);
    var services = (book.repas.reduce(function (s, n) { return s + n; }, 0) + book.chauffage.reduce(function (s, n) { return s + n; }, 0) + book.surplace) * 100;
    var spent = all.reduce(function (sum, item) { return sum + Math.round(item.montant_eur * 100); }, 0);
    var marge = roll.net + services - spent;
    var rows = monthItems.map(function (item) {
      var facture = item.facture_url
        ? '<button type="button" class="bill-link is-on" data-facture="' + esc(item.id) + '">Facture jointe</button>'
        : '<span class="bill-link">Sans facture</span>';
      return '<a class="exp" href="depense.html?id=' + encodeURIComponent(item.id) + '">' + icon(item.categorie)
        + '<span class="exp-title">' + esc(expenseTitle(item)) + '</span>'
        + '<span class="exp-sub">' + esc(dayText(item.date) + " · " + dirhams(Math.round(item.montant_eur * 100)).replace("\u00A0DH", "\u00A0DH")) + "</span>"
        + '<b>' + esc(money(Math.round(item.montant_eur * 100))) + "</b>" + facture + "</a>";
    }).join("");
    return '<div class="stat-2">' + tile("Dépenses du mois", esc(money(monthEur)), esc(dirhams(monthEur) + " · " + monthItems.length + " écriture" + (monthItems.length > 1 ? "s" : "")))
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
    return '<button type="button" class="period" data-open-period>Année ' + state.year + "</button>";
  }
  function panel() {
    if (state.view === "services") return servicesHtml();
    if (state.view === "depenses") return depensesHtml();
    return sejoursHtml();
  }
  function paint() {
    var root = document.querySelector("[data-stats]");
    root.innerHTML = '<div class="stats-top"><h1>Stats</h1><div class="stats-tools">' + tools() + "</div></div>"
      + '<div class="segment" role="group" aria-label="Vue">' + VIEWS.map(function (item) {
        var on = item[0] === state.view;
        return '<button type="button" data-view="' + item[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + item[1] + "</button>";
      }).join("") + "</div>"
      + '<div class="stats-panel">' + panel() + "</div>";
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
      html = '<p class="kicker">Année</p>' + [2026, 2025, 2024].map(function (year) {
        return '<button type="button" class="statut-choice' + (year === state.year ? " is-current" : "") + '" data-year="' + year + '">Année ' + year + "</button>";
      }).join("");
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
    if (asked === "services" || asked === "depenses" || asked === "sejours") state.view = asked;
    root.addEventListener("click", function (event) {
      var view = event.target.closest("[data-view]");
      if (view) { state.view = view.getAttribute("data-view"); paint(); return; }
      if (event.target.closest("[data-open-period]")) { openPeriod(); return; }
      var facture = event.target.closest("[data-facture]");
      if (facture) { event.preventDefault(); showPhoto(facture.getAttribute("data-facture")); }
    });
    document.addEventListener("click", function (event) {
      var year = event.target.closest("[data-year]");
      if (year) { state.year = Number(year.getAttribute("data-year")); state.month = state.year + "-12"; closeSheet(); paint(); return; }
      var month = event.target.closest("[data-month]");
      if (month) { state.month = month.getAttribute("data-month"); closeSheet(); paint(); return; }
      if (event.target.closest("[data-sheet-close]") || event.target.hasAttribute("data-sheet-back")) closeSheet();
      if (event.target.closest("[data-photo-close]") || event.target.hasAttribute("data-photo")) document.querySelector("[data-photo]").hidden = true;
    });
    paint();
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
    todayIso: todayIso
  };
})();
