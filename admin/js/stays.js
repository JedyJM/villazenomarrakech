/* Séjours: list, new stay, fiche, confirmation email. French. Real Sheet stays only (action=stays). */
(function () {
  "use strict";

  var calc = window.AdminCalc;
  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return "test"; } };
  var STORE = "vz.admin.stays";
  var PATCH = "vz.admin.patches";
  var nbsp = "\u00A0";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function readJson(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || ""); } catch (e) { return null; }
  }
  // Stays from the Sheet (action=stays), null until loaded.
  var remote = null;
  // Real data only: origine "test" rows are hidden unless the « Jeu de
  // test » switch (Réglages, off by default) is on.
  function realOnly(list) {
    return shell.realOnly ? shell.realOnly(list || []) : (list || []).filter(function (row) { return String((row && row.origine) || "").toLowerCase() !== "test"; });
  }
  // Daily cache (AdminShell.cachedGet): done may run twice, first with the
  // cached answer, then with the network one. meta: { at, cached, stale }.
  var loadMeta = { at: 0 };
  function loadStays(done, force) {
    if (!shell.cachedGet) {
      if (remote || !shell.SCRIPT_URL || !window.fetch) { remote = remote || []; done(loadMeta); return; }
      var url = shell.SCRIPT_URL + "?action=stays&token=" + encodeURIComponent(shell.session()) + (shell.TEST_MODE ? "&test=1" : "");
      window.fetch(url).then(function (res) { return res.json(); }).then(function (data) {
        remote = (data && data.ok && data.stays) || [];
        done(loadMeta);
      }).catch(function () { remote = []; done(loadMeta); });
      return;
    }
    shell.cachedGet("stays", "action=stays", function (data, meta) {
      remote = (data && data.ok && data.stays) || remote || [];
      if (meta && meta.at) loadMeta = meta;
      done(loadMeta);
    }, { force: !!force, valid: hasTotals });
  }
  // Zen'O rows must carry totalVoyageur (Stats brut); a cached answer from
  // a script version without it is never reused.
  function hasTotals(data) {
    var list = (data && data.stays) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].portal !== false && !("totalVoyageur" in list[i])) return false;
    return true;
  }
  // Other properties (M avenue, La tour): stats rows (action=stays-stats),
  // no guest name by design. Same cache key as Stats.
  var others = null;
  function loadOthers(done, force) {
    if (!shell.cachedGet) { others = others || []; done(); return; }
    shell.cachedGet("stays-stats", "action=stays-stats", function (data) {
      others = (data && data.ok && data.stays) || others || [];
      done();
    }, { force: !!force, valid: hasTotals });
  }

  /* Booking sources (new stay form, lists, stay card). kind picks the price
     block: "airbnb", "booking", or "direct" (tarif, acompte, date, mode,
     reste à payer). To add an agency, add one line here; askName asks for
     the agency name (saved as agency / agence_nom). */
  var SOURCES = [
    { value: "Airbnb", label: "Airbnb", kind: "airbnb" },
    { value: "Booking", label: "Booking.com", kind: "booking" },
    { value: "Direct", label: "Direct", kind: "direct" },
    { value: "Villanovo", label: "Villanovo", kind: "direct" },
    { value: "Marrakech Best Of", label: "Marrakech Best Of", kind: "direct" },
    { value: "Autre agence", label: "Autre agence", kind: "direct", askName: true }
  ];

  function sourceInfo(value) {
    for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].value === value) return SOURCES[i];
    return null;
  }

  function sourceKind(value) {
    var info = sourceInfo(value);
    return info ? info.kind : "direct";
  }

  function sourceLabel(stay) {
    var info = sourceInfo(stay.source);
    if (info && info.askName && stay.agency) return stay.agency;
    return info ? info.label : String(stay.source || "");
  }

  function withDerived(stay) {
    var copy = Object.assign({}, stay);
    copy.nights = calc.nights(copy.arrival, copy.departure);
    if (copy.poolOffert && copy.nights > 0) copy.poolDays = copy.nights;
    if (copy.jacuzziOffert && copy.nights > 0) copy.jacuzziDays = copy.nights;
    if (!copy.lien_expire_le) copy.lien_expire_le = calc.addDays(copy.departure, 3);
    var kind = sourceKind(copy.source);
    if (kind === "airbnb") copy.gain = calc.airbnbGain(copy.room, copy.reduction, copy.hostFee);
    if (kind === "booking") {
      copy.net = calc.bookingNet(copy.total, copy.commission, copy.bank);
      copy.tax = calc.bookingTax((copy.adults || 0) + (copy.children || 0), copy.nights);
    }
    if (kind === "direct") copy.due = calc.directDue(copy.tarif, copy.deposit);
    return copy;
  }

  function allStays() {
    var created = readJson(STORE) || [];
    var patches = readJson(PATCH) || {};
    var seen = {};
    created.forEach(function (stay) { seen[stay.id] = true; });
    var base = (remote || []).filter(function (stay) { return stay.id && !seen[stay.id] && stay.portal !== false; });
    return realOnly(base.concat(created)).filter(function (stay) {
      return !/annul|cancel/i.test(String(stay.statut || ""));
    }).map(function (stay) {
      return withDerived(Object.assign({}, stay, patches[stay.id] || {}));
    });
  }

  function findStay(id) {
    var found = null;
    allStays().forEach(function (stay) { if (stay.id === id) found = stay; });
    return found;
  }

  function persist(stay) {
    var created = readJson(STORE) || [];
    created = created.filter(function (item) { return item.id !== stay.id; });
    created.push(stay);
    try { sessionStorage.setItem(STORE, JSON.stringify(created)); } catch (e) {}
    postScript({ action: "save-stay", test: shell.TEST_MODE ? "1" : "", token: shell.session(), stay: sheetStay(stay) });
  }

  function patchStay(id, fields, op) {
    var patches = readJson(PATCH) || {};
    patches[id] = Object.assign({}, patches[id] || {}, fields);
    try { sessionStorage.setItem(PATCH, JSON.stringify(patches)); } catch (e) {}
    postScript({ action: "stay-link", test: shell.TEST_MODE ? "1" : "", token: shell.session(), id: id, op: op });
  }

  function sheetStay(stay) {
    var kind = sourceKind(stay.source);
    return {
      booking_id: stay.id,
      nom: stay.nom,
      telephone: stay.telephone,
      date_arrivee: stay.arrival,
      date_depart: stay.departure,
      source: stay.source,
      agence_nom: sourceInfo(stay.source) && sourceInfo(stay.source).askName ? (stay.agency || "") : "",
      adultes: stay.adults,
      enfants: stay.children,
      ages_enfants: (stay.ages || []).join(","),
      notes: stay.notes || "",
      lien_actif: stay.lien_actif !== false,
      lien_expire_le: stay.lien_expire_le || calc.addDays(stay.departure, 3),
      airbnb_frais_chambre: kind === "airbnb" ? (stay.room || 0) / 100 : "",
      airbnb_reduction: kind === "airbnb" ? (stay.reduction || 0) / 100 : "",
      airbnb_frais_service: kind === "airbnb" ? (stay.hostFee || 0) / 100 : "",
      airbnb_gain: kind === "airbnb" ? (stay.gain || 0) / 100 : "",
      booking_montant: kind === "booking" ? (stay.total || 0) / 100 : "",
      booking_commission: kind === "booking" ? (stay.commission || 0) / 100 : "",
      booking_frais_bancaires: kind === "booking" ? (stay.bank || 0) / 100 : "",
      booking_net: kind === "booking" ? (stay.net || 0) / 100 : "",
      direct_tarif: kind === "direct" ? (stay.tarif || 0) / 100 : "",
      acompte_montant: kind === "direct" ? (stay.deposit || 0) / 100 : "",
      acompte_date: stay.depositDate || "",
      acompte_mode: stay.depositMode || "",
      reste_a_payer: kind === "direct" ? (stay.due || 0) / 100 : "",
      offert_petit_dejeuner: !!stay.breakfast,
      chauffage_piscine_jours: stay.poolDays || 0,
      chauffage_piscine_tarif_eur: stay.poolRate ? stay.poolRate / 100 : 0,
      chauffage_piscine_offert: !!stay.poolOffert,
      chauffage_jacuzzi_jours: stay.jacuzziDays || 0,
      chauffage_jacuzzi_tarif_eur: stay.jacuzziRate ? stay.jacuzziRate / 100 : 0,
      chauffage_jacuzzi_offert: !!stay.jacuzziOffert,
      encaisse_total_eur: stay.encaisse_total_eur || "",
      encaisse_mode: stay.encaisse_mode || "",
      encaisse_le: stay.encaisse_le || "",
      offerts: Array.isArray(stay.offerts) ? stay.offerts.join(",") : (stay.offerts || "")
    };
  }

  function postScript(payload) {
    // A write makes the cached stays stale: the next open refetches.
    if (shell.invalidate) shell.invalidate("stays");
    if (!shell.SCRIPT_URL || !window.fetch) return;
    window.fetch(shell.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function peopleBits(stay) {
    var bits = [stay.adults + " ad."];
    if (stay.children) bits.push(stay.children + " enf.");
    bits.push(stay.nights + " nuit" + (stay.nights > 1 ? "s" : ""));
    return bits.join(" · ");
  }

  function composition(stay) {
    var text = stay.adults + " adulte" + (stay.adults > 1 ? "s" : "");
    if (stay.children) {
      text += " · " + stay.children + " enfant" + (stay.children > 1 ? "s" : "");
      var ages = (stay.ages || []).filter(function (age) { return age !== "" && age != null; });
      if (ages.length) text += " · " + ages.map(function (age) { return age + " ans"; }).join(" et ");
    }
    return text;
  }

  function chipClass(status) {
    if (status === "cours") return "is-cours";
    if (status === "fini") return "is-fini";
    return "is-venir";
  }
  function chipLabel(status) {
    if (status === "cours") return "En cours";
    if (status === "fini") return "Terminé";
    return "À venir";
  }

  function portalUrl(id) {
    return "https://villazenomarrakech.com/guest/?stay=" + encodeURIComponent(id);
  }

  function firstName(nom) {
    return String(nom || "").trim().split(/\s+/)[0] || "";
  }

  function waHref(stay) {
    var digits = String(stay.telephone || "").replace(/\D/g, "");
    var text = "Bonjour " + firstName(stay.nom) + ", votre espace invité Villa Zen’O : " + portalUrl(stay.id);
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
  }

  function offerNames(stay) {
    var names = [];
    if (stay.breakfast) names.push("petit-déjeuner");
    if (stay.poolOffert) names.push("chauffage piscine");
    if (stay.jacuzziOffert) names.push("chauffage jacuzzi");
    return names;
  }

  /* Calendar channels (Séjours calendar and legend). Text colour is set in
     admin.css per channel for contrast (white on Booking, ink elsewhere). */
  var CHANNELS = [
    ["airbnb", "Airbnb"],
    ["booking", "Booking.com"],
    ["direct", "Direct"],
    ["agences", "Agences"],
    ["famille", "Famille"],
    ["autre", "Autre"]
  ];
  var CHANNEL_LABEL = {};
  CHANNELS.forEach(function (c) { CHANNEL_LABEL[c[0]] = c[1]; });
  function channelOf(source, agency) {
    var s = String(source || "").trim().toLowerCase();
    var a = String(agency || "").trim().toLowerCase();
    if (/famil/.test(s + " " + a)) return "famille";
    if (s.indexOf("airbnb") >= 0) return "airbnb";
    if (s.indexOf("booking") >= 0) return "booking";
    if (!s || s === "direct") return "direct";
    if (/villanovo|best of|agence|agency/.test(s)) return "agences";
    return "autre";
  }

  var ZENO = "Villa Zen'O";
  var BIENS = [[ZENO, "Zen’O"], ["M avenue", "M avenue"], ["Villa la tour", "La tour"]];
  var MONTH_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
  var VIEW_KEY = "vz.admin.sejours.vue";

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function isoOf(y, m, d) { return y + "-" + pad2(m) + "-" + pad2(d); }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  // Bands for one property. Zen'O: portal stays (first name, fiche link).
  // Others: stats rows, no guest data: the band shows the channel.
  function calendarStays(bien) {
    if (bien === ZENO) {
      return allStays().filter(function (stay) {
        return !stay.hidden && stay.arrival && stay.departure && stay.departure > stay.arrival;
      }).map(function (stay) {
        return {
          arrival: stay.arrival, departure: stay.departure,
          channel: channelOf(stay.source, stay.agency),
          label: firstName(stay.nom) || sourceLabel(stay),
          href: "sejour.html?id=" + encodeURIComponent(stay.id),
          title: (stay.nom || "") + " · " + sourceLabel(stay) + " · " + calc.rangeLabel(stay.arrival, stay.departure)
        };
      });
    }
    return realOnly(others || []).filter(function (row) {
      return String(row.bien || "") === bien && row.arrival && row.departure && row.departure > row.arrival
        && !/annul|cancel/i.test(String(row.statut || ""));
    }).map(function (row) {
      var channel = channelOf(row.source, "");
      return {
        arrival: row.arrival, departure: row.departure, channel: channel,
        label: CHANNEL_LABEL[channel] === "Booking.com" ? "Booking" : CHANNEL_LABEL[channel],
        href: "",
        title: CHANNEL_LABEL[channel] + " · " + calc.rangeLabel(row.arrival, row.departure)
      };
    });
  }

  function bootList() {
    var root = document.querySelector("[data-sejours]");
    if (!root) return;
    var list = root.querySelector("[data-list]");
    var year = root.querySelector("[data-year]");
    var empty = root.querySelector("[data-empty]");
    var cal = root.querySelector("[data-cal]");
    var title = root.querySelector("[data-cal-title]");
    var biensBox = root.querySelector("[data-biens]");
    var legend = root.querySelector("[data-legend]");
    var stamp = root.querySelector("[data-stamp]");
    var refresh = root.querySelector("[data-refresh]");
    var today = calc.todayIso();
    var state = { view: "cal", bien: ZENO, y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) };
    try {
      var saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
      if (saved && saved.view) state = Object.assign(state, saved);
    } catch (e) {}
    function save() { try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(state)); } catch (e) {} }

    var current = today.slice(0, 4);
    [String(Number(current) - 1), current, String(Number(current) + 1)].forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (value === current) option.selected = true;
      year.appendChild(option);
    });
    biensBox.innerHTML = BIENS.map(function (b) {
      return '<button type="button" data-bien="' + esc(b[0]) + '" aria-pressed="false">' + esc(b[1]) + "</button>";
    }).join("");
    legend.innerHTML = CHANNELS.map(function (c) {
      return '<li><i class="ch-' + c[0] + '" aria-hidden="true"></i>' + esc(c[1]) + "</li>";
    }).join("");

    function paintList() {
      var selected = year.value;
      var rows = allStays().filter(function (stay) {
        return !stay.hidden && String(stay.arrival || "").slice(0, 4) === selected;
      });
      var order = { cours: 0, venir: 1, fini: 2 };
      rows.sort(function (a, b) {
        var sa = calc.statusOf(a.arrival, a.departure, today);
        var sb = calc.statusOf(b.arrival, b.departure, today);
        if (order[sa] !== order[sb]) return order[sa] - order[sb];
        return String(a.arrival).localeCompare(String(b.arrival));
      });
      var any = allStays().length > 0;
      empty.hidden = rows.length > 0;
      empty.textContent = remote === null ? "Chargement des séjours…" : (any ? "Aucun séjour en " + selected + "." : "Aucune donnée réelle");
      list.hidden = !rows.length;
      list.innerHTML = rows.map(function (stay) {
        var status = calc.statusOf(stay.arrival, stay.departure, today);
        return '<a class="stay-row" href="sejour.html?id=' + esc(stay.id) + '">'
          + '<span class="stay-top"><span class="stay-name">' + esc(stay.nom) + '</span>'
          + '<span class="chip ' + chipClass(status) + '">' + chipLabel(status) + '</span></span>'
          + '<span class="stay-sub"><span class="stay-meta">' + esc(calc.rangeLabel(stay.arrival, stay.departure) + " · " + peopleBits(stay)) + '</span>'
          + '<span class="stay-source">' + esc(sourceLabel(stay)) + '</span></span>'
          + '<span class="chev" aria-hidden="true">›</span></a>';
      }).join("");
    }

    // Airbnb-style month: one band per stay, from the arrival afternoon to
    // the departure morning (half cells), split per week row.
    function paintCal() {
      var y = state.y;
      var m = state.m;
      title.textContent = MONTH_FULL[m - 1] + " " + y;
      var first = isoOf(y, m, 1);
      var lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
      var start = calc.addDays(first, -lead);
      var weeks = Math.ceil((lead + dim(y, m)) / 7);
      var items = calendarStays(state.bien);
      var html = '<div class="cal-head">' + WEEKDAYS.map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div>";
      for (var w = 0; w < weeks; w++) {
        var ws = calc.addDays(start, w * 7);
        var we = calc.addDays(ws, 7);
        var segs = [];
        items.forEach(function (it) {
          if (!(it.arrival < we && it.departure >= ws)) return;
          var contL = it.arrival < ws;
          var contR = it.departure >= we;
          var left = contL ? 0 : calc.nights(ws, it.arrival) + 0.5;
          var right = contR ? 7 : calc.nights(ws, it.departure) + 0.5;
          if (right <= left) return;
          segs.push({ it: it, left: left, right: right, contL: contL, contR: contR });
        });
        segs.sort(function (a, b) { return a.left - b.left; });
        var lanes = [];
        segs.forEach(function (seg) {
          var lane = 0;
          while (lanes[lane] != null && lanes[lane] > seg.left + 0.01) lane++;
          lanes[lane] = seg.right;
          seg.lane = lane;
        });
        var laneCount = Math.max(1, lanes.length);
        var days = "";
        for (var d = 0; d < 7; d++) {
          var iso = calc.addDays(ws, d);
          var cls = (iso.slice(0, 7) !== first.slice(0, 7) ? " is-out" : "") + (iso === today ? " is-today" : "");
          days += '<span class="cal-day' + cls + '"><b>' + Number(iso.slice(8, 10)) + "</b></span>";
        }
        var bands = segs.map(function (seg) {
          var it = seg.it;
          var width = seg.right - seg.left;
          var cls = "band ch-" + it.channel + (seg.contL ? " is-cont-l" : "") + (seg.contR ? " is-cont-r" : "");
          var style = "left:calc(" + (seg.left / 7 * 100).toFixed(4) + "% + 1px);width:calc(" + (width / 7 * 100).toFixed(4) + "% - 2px);top:" + (22 + seg.lane * 21) + "px";
          var label = width >= 0.9 ? '<span>' + esc(it.label) + "</span>" : "";
          var attrs = ' class="' + cls + '" style="' + style + '" title="' + esc(it.title) + '" aria-label="' + esc(it.title) + '"';
          return it.href ? "<a" + attrs + ' href="' + esc(it.href) + '">' + label + "</a>" : "<span" + attrs + ">" + label + "</span>";
        }).join("");
        html += '<div class="cal-week" style="height:' + (22 + laneCount * 21 + 5) + 'px"><div class="cal-days">' + days + "</div>" + bands + "</div>";
      }
      cal.innerHTML = html;
      biensBox.querySelectorAll("[data-bien]").forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-bien") === state.bien ? "true" : "false");
      });
    }

    function paintStamp(meta) {
      if (remote === null) { stamp.textContent = "Chargement des séjours…"; return; }
      stamp.textContent = shell.stampText ? shell.stampText(meta && meta.at) : "";
    }

    function paint() {
      root.querySelector("[data-cal-view]").hidden = state.view !== "cal";
      root.querySelector("[data-list-view]").hidden = state.view !== "list";
      root.querySelectorAll("[data-view]").forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-view") === state.view ? "true" : "false");
      });
      if (state.view === "cal") paintCal();
      else paintList();
      paintStamp(loadMeta);
    }

    function shift(dir) {
      state.m += dir;
      if (state.m < 1) { state.m = 12; state.y -= 1; }
      if (state.m > 12) { state.m = 1; state.y += 1; }
      save();
      paint();
    }

    root.addEventListener("click", function (event) {
      var view = event.target.closest("[data-view]");
      if (view) { state.view = view.getAttribute("data-view"); save(); paint(); return; }
      var bien = event.target.closest("[data-bien]");
      if (bien) { state.bien = bien.getAttribute("data-bien"); save(); paint(); return; }
      if (event.target.closest("[data-cal-prev]")) { shift(-1); return; }
      if (event.target.closest("[data-cal-next]")) { shift(1); return; }
      if (event.target.closest("[data-cal-today]")) {
        state.y = Number(today.slice(0, 4));
        state.m = Number(today.slice(5, 7));
        save();
        paint();
      }
    });
    var touchX = null;
    var touchY = 0;
    cal.addEventListener("touchstart", function (event) {
      touchX = event.touches[0].clientX;
      touchY = event.touches[0].clientY;
    }, { passive: true });
    cal.addEventListener("touchend", function (event) {
      if (touchX == null) return;
      var dx = event.changedTouches[0].clientX - touchX;
      var dy = event.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    }, { passive: true });
    year.addEventListener("change", paint);
    refresh.addEventListener("click", function () {
      refresh.disabled = true;
      stamp.textContent = "Mise à jour…";
      var pending = 2;
      function one() {
        pending -= 1;
        if (pending > 0) return;
        refresh.disabled = false;
        paint();
      }
      // force: today's cache is skipped, each loader calls back once (network
      // answer; on failure the cached data stays on screen).
      loadStays(one, true);
      loadOthers(one, true);
    });
    paint();
    loadStays(paint);
    loadOthers(paint);
  }

  function blank() {
    return {
      nom: "", telephone: "", arrival: "", departure: "", source: "Airbnb", agency: "",
      adults: 2, children: 0, ages: [], notes: "",
      room: 0, reduction: 0, hostFee: 0,
      total: 0, commission: 0, bank: 0,
      tarif: 0, deposit: 0, depositDate: "", depositMode: "Virement",
      breakfast: false, poolOffert: false, jacuzziOffert: false,
      poolDays: 0, poolRate: 0, jacuzziDays: 0, jacuzziRate: 0
    };
  }

  function bootForm() {
    var form = document.querySelector("[data-stay-form]");
    if (!form) return;
    var model = blank();
    var agesBox = form.querySelector("[data-ages]");
    var price = form.querySelector("[data-price]");
    var save = form.querySelector("[data-save]");
    var error = form.querySelector("[data-error]");
    var sourcesBox = form.querySelector("[data-sources]");
    var agencyBox = form.querySelector("[data-agency]");

    function field(name) { return form.querySelector("[name='" + name + "']"); }

    function readCommon() {
      model.nom = field("nom").value.trim();
      model.telephone = field("telephone").value.trim();
      model.arrival = field("arrival").value;
      model.departure = field("departure").value;
      model.notes = field("notes").value.trim();
      if (field("agency")) model.agency = field("agency").value.trim();
      model.poolDays = Number(field("poolDays").value) || 0;
      model.poolRate = calc.cents(field("poolRate").value);
      model.jacuzziDays = Number(field("jacuzziDays").value) || 0;
      model.jacuzziRate = calc.cents(field("jacuzziRate").value);
      model.ages = [];
      agesBox.querySelectorAll("input").forEach(function (input) {
        model.ages.push(input.value === "" ? "" : Number(input.value));
      });
    }

    function readPrice() {
      var kind = sourceKind(model.source);
      // Offerts exist for every source.
      ["breakfast", "poolOffert", "jacuzziOffert"].forEach(function (name) {
        var box = price.querySelector("[name='" + name + "']");
        if (box) model[name] = box.checked;
      });
      if (kind === "airbnb") {
        model.room = calc.cents(price.querySelector("[name='room']").value);
        model.reduction = calc.cents(price.querySelector("[name='reduction']").value);
        model.hostFee = calc.cents(price.querySelector("[name='hostFee']").value);
      } else if (kind === "booking") {
        model.total = calc.cents(price.querySelector("[name='total']").value);
        model.commission = calc.cents(price.querySelector("[name='commission']").value);
        model.bank = calc.cents(price.querySelector("[name='bank']").value);
      } else {
        model.tarif = calc.cents(price.querySelector("[name='tarif']").value);
        model.deposit = calc.cents(price.querySelector("[name='deposit']").value);
        model.depositDate = price.querySelector("[name='depositDate']").value;
        price.querySelectorAll("[data-mode]").forEach(function (button) {
          if (button.getAttribute("aria-pressed") === "true") model.depositMode = button.getAttribute("data-mode");
        });
      }
    }

    function amountText(centsValue) {
      var n = Math.abs(Math.round(Number(centsValue) || 0));
      if (!n) return "";
      var whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
      var frac = String(n % 100);
      if (frac.length < 2) frac = "0" + frac;
      return whole + "," + frac;
    }

    function amountInput(name, label, value, negative) {
      var shown = amountText(value);
      return '<label class="money-row"><span class="lbl">' + label + '</span><span class="amount">'
        + (negative ? '<i>−</i>' : '')
        + '<input class="amt" name="' + name + '" inputmode="decimal" autocomplete="off" value="' + esc(shown) + '">'
        + '<span class="euro">€</span></span></label>';
    }

    function paintAges() {
      var html = "";
      for (var i = 0; i < model.children; i++) {
        var value = model.ages[i] == null ? "" : model.ages[i];
        html += '<label class="age-row"><span>Âge enfant ' + (i + 1) + '</span>'
          + '<input name="age' + i + '" inputmode="numeric" value="' + esc(value) + '"></label>';
      }
      agesBox.innerHTML = html;
    }

    function paintPrice() {
      var nights = calc.nights(model.arrival, model.departure);
      var nightLabel = nights > 0 ? String(nights) : "N";
      var nightWord = nights === 1 ? " nuit" : " nuits";
      var html = "";
      var kind = sourceKind(model.source);
      if (kind === "airbnb") {
        var gain = calc.airbnbGain(model.room, model.reduction, model.hostFee);
        html = '<p class="kicker">Revenus Airbnb</p>'
          + amountInput("room", "Frais de chambre pour " + nightLabel + nightWord, model.room)
          + amountInput("reduction", "Réduction", model.reduction, true)
          + amountInput("hostFee", "Frais de service hôte (15,5 % + TVA)", model.hostFee, true)
          + '<p class="money-row"><span class="lbl">Vous gagnez</span><strong data-out>' + esc(calc.money(gain)) + '</strong></p>'
          + '<p class="hint">Recopiez ces montants depuis l’onglet Revenus d’Airbnb.</p>';
      } else if (kind === "booking") {
        var net = calc.bookingNet(model.total, model.commission, model.bank);
        var people = (model.adults || 0) + (model.children || 0);
        var tax = calc.bookingTax(people, nights);
        html = '<p class="kicker">Détail du tarif Booking.com</p>'
          + amountInput("total", "Montant total de la réservation", model.total)
          + amountInput("commission", "Commission", model.commission, true)
          + amountInput("bank", "Frais bancaires (2 %)", model.bank, true)
          + '<p class="money-row"><span class="lbl">Net</span><strong data-out>' + esc(calc.money(net)) + '</strong></p>'
          + '<p class="tax-note"><span>Taxe de séjour 2,50' + nbsp + '€ / pers. / nuit' + nbsp + ': demandée au client sur la facture finale</span><strong data-tax>' + esc(calc.money(tax)) + '</strong></p>';
      } else {
        var due = calc.directDue(model.tarif, model.deposit);
        html = '<p class="kicker">' + (model.source === "Direct" ? "Tarif direct" : "Tarif " + esc(sourceLabel(model) === "Autre agence" ? "agence" : sourceLabel(model))) + '</p>'
          + amountInput("tarif", "Tarif total", model.tarif)
          + amountInput("deposit", "Acompte reçu", model.deposit)
          + '<label class="money-row"><span class="lbl">Date de l’acompte</span><span class="date-fr"><input type="date" lang="fr" name="depositDate" value="' + esc(model.depositDate) + '"><span class="date-face" data-date-face></span></span></label>'
          + '<div class="modes" role="group" aria-label="Mode de l’acompte">'
          + ["Virement", "Espèces", "PayPal"].map(function (mode) {
            var on = model.depositMode === mode;
            return '<button type="button" data-mode="' + mode + '" aria-pressed="' + (on ? "true" : "false") + '">' + mode + '</button>';
          }).join("")
          + '</div>'
          + '<p class="money-row"><span class="lbl">Reste à payer</span><strong data-out>' + esc(calc.money(due)) + '</strong></p>';
      }
      html += '<p class="kicker">Offerts</p>'
        + '<div class="offers">'
        + offerBox("breakfast", "Petit-déjeuner", model.breakfast)
        + offerBox("poolOffert", "Chauffage piscine", model.poolOffert)
        + offerBox("jacuzziOffert", "Chauffage jacuzzi", model.jacuzziOffert)
        + '</div>';
      price.innerHTML = html;
      paintDateFace();
      save.textContent = model.source === "Direct" ? "Préparer l’e-mail de confirmation" : "Enregistrer le séjour";
    }

    function paintDateFace(root) {
      (root || form).querySelectorAll(".date-fr").forEach(function (box) {
        var input = box.querySelector("input");
        var face = box.querySelector("[data-date-face]");
        if (!input || !face) return;
        if (input.value) {
          face.textContent = calc.dayText(input.value, true);
          face.classList.remove("is-empty");
        } else {
          face.textContent = "Choisir";
          face.classList.add("is-empty");
        }
      });
    }

    function syncOffers() {
      var nights = calc.nights(model.arrival, model.departure);
      if (model.poolOffert && nights > 0) model.poolDays = nights;
      if (model.jacuzziOffert && nights > 0) model.jacuzziDays = nights;
    }

    function offerBox(name, label, on) {
      return '<label><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + '>' + label + '</label>';
    }

    function readPriceSafe() {
      if (price.querySelector("input, button")) readPrice();
    }

    function paintSource() {
      if (sourcesBox && !sourcesBox.children.length) {
        sourcesBox.innerHTML = SOURCES.map(function (item) {
          return '<button type="button" data-source="' + esc(item.value) + '" aria-pressed="false">' + esc(item.label) + '</button>';
        }).join("");
      }
      var info = sourceInfo(model.source);
      if (agencyBox) agencyBox.hidden = !(info && info.askName);
      if (field("agency")) field("agency").value = model.agency || "";
      form.querySelectorAll("[data-source]").forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-source") === model.source ? "true" : "false");
      });
    }

    function paintSteps() {
      form.querySelector("[data-adults]").textContent = String(model.adults);
      form.querySelector("[data-children]").textContent = String(model.children);
      form.querySelector("[data-pool-days]").textContent = String(model.poolDays);
      form.querySelector("[data-jacuzzi-days]").textContent = String(model.jacuzziDays);
      field("poolDays").value = String(model.poolDays);
      field("jacuzziDays").value = String(model.jacuzziDays);
      var poolFlag = form.querySelector("[data-pool-flag]");
      var jacuzziFlag = form.querySelector("[data-jacuzzi-flag]");
      var poolTarif = form.querySelector("[data-pool-tarif]");
      var jacuzziTarif = form.querySelector("[data-jacuzzi-tarif]");
      if (poolFlag) poolFlag.hidden = !model.poolOffert;
      if (jacuzziFlag) jacuzziFlag.hidden = !model.jacuzziOffert;
      if (poolTarif) poolTarif.hidden = !!model.poolOffert;
      if (jacuzziTarif) jacuzziTarif.hidden = !!model.jacuzziOffert;
    }

    function fill() {
      field("nom").value = model.nom;
      field("telephone").value = model.telephone;
      field("arrival").value = model.arrival;
      field("departure").value = model.departure;
      field("notes").value = model.notes || "";
      field("poolRate").value = model.poolRate ? String(model.poolRate / 100).replace(".", ",") : "";
      field("jacuzziRate").value = model.jacuzziRate ? String(model.jacuzziRate / 100).replace(".", ",") : "";
      syncOffers();
      paintSource();
      paintSteps();
      paintAges();
      paintPrice();
      paintDateFace();
    }

    // The agency error is set on submit only; it goes away as soon as a
    // name is typed or the source no longer asks for one.
    var AGENCY_ERROR = "Indiquez le nom de l’agence.";
    function clearAgencyError() {
      if (error.textContent !== AGENCY_ERROR) return;
      var input = form.querySelector("[name='agency']");
      var info = sourceInfo(model.source);
      if (!info || !info.askName || (input && input.value.trim())) error.textContent = "";
    }

    form.addEventListener("click", function (event) {
      var source = event.target.closest("[data-source]");
      if (source) {
        readCommon();
        readPriceSafe();
        model.source = source.getAttribute("data-source");
        clearAgencyError();
        paintSource();
        paintAges();
        paintPrice();
        return;
      }
      var step = event.target.closest("[data-step]");
      if (step) {
        var key = step.getAttribute("data-step");
        var dir = Number(step.getAttribute("data-dir"));
        if (key === "adults") model.adults = Math.max(1, Math.min(16, model.adults + dir));
        if (key === "children") {
          readCommon();
          model.children = Math.max(0, Math.min(8, model.children + dir));
          paintAges();
        }
        if (key === "poolDays") {
          var poolNights = calc.nights(model.arrival, model.departure);
          model.poolDays = model.poolOffert && poolNights > 0 ? poolNights : Math.max(0, Math.min(30, model.poolDays + dir));
        }
        if (key === "jacuzziDays") {
          var jacuzziNights = calc.nights(model.arrival, model.departure);
          model.jacuzziDays = model.jacuzziOffert && jacuzziNights > 0 ? jacuzziNights : Math.max(0, Math.min(30, model.jacuzziDays + dir));
        }
        paintSteps();
        if (sourceKind(model.source) !== "direct") paintPrice();
        return;
      }
      var mode = event.target.closest("[data-mode]");
      if (mode) {
        readPriceSafe();
        model.depositMode = mode.getAttribute("data-mode");
        paintPrice();
      }
    });
    form.addEventListener("input", function (event) {
      if (event.target.name === "agency") clearAgencyError();
      if (event.target.name === "arrival" || event.target.name === "departure") {
        readCommon();
        readPriceSafe();
        syncOffers();
        paintSteps();
        paintPrice();
        paintDateFace();
        return;
      }
      if (event.target.type === "date") paintDateFace();
      if (!price.contains(event.target)) return;
      readPriceSafe();
      var out = price.querySelector("[data-out]");
      var nights = calc.nights(model.arrival, model.departure);
      var kind = sourceKind(model.source);
      if (kind === "airbnb" && out) out.textContent = calc.money(calc.airbnbGain(model.room, model.reduction, model.hostFee));
      else if (kind === "booking") {
        if (out) out.textContent = calc.money(calc.bookingNet(model.total, model.commission, model.bank));
        var taxNode = price.querySelector("[data-tax]");
        if (taxNode) taxNode.textContent = calc.money(calc.bookingTax((model.adults || 0) + (model.children || 0), nights));
      }       else if (out) out.textContent = calc.money(calc.directDue(model.tarif, model.deposit));
    });
    form.addEventListener("change", function (event) {
      var name = event.target.name;
      if (name === "agency") clearAgencyError();
      if (name !== "poolOffert" && name !== "jacuzziOffert") return;
      readPriceSafe();
      var nights = calc.nights(model.arrival, model.departure);
      if (name === "poolOffert") model.poolDays = model.poolOffert && nights > 0 ? nights : (model.poolOffert ? model.poolDays : 0);
      if (name === "jacuzziOffert") model.jacuzziDays = model.jacuzziOffert && nights > 0 ? nights : (model.jacuzziOffert ? model.jacuzziDays : 0);
      paintSteps();
    });
    form.addEventListener("focusout", function (event) {
      if (!event.target.classList || !event.target.classList.contains("amt")) return;
      event.target.value = amountText(calc.cents(event.target.value));
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      readCommon();
      readPriceSafe();
      var nights = calc.nights(model.arrival, model.departure);
      var message = "";
      if (!model.nom) message = "Indiquez le nom.";
      else if (!model.telephone) message = "Indiquez le téléphone WhatsApp.";
      else if (!model.arrival || !model.departure || nights < 1) message = "Indiquez des dates d’arrivée et de départ.";
      else if (sourceInfo(model.source) && sourceInfo(model.source).askName && !model.agency) message = AGENCY_ERROR;
      else if (sourceKind(model.source) === "airbnb" && !model.room) message = "Indiquez les frais de chambre.";
      else if (sourceKind(model.source) === "booking" && !model.total) message = "Indiquez le montant total.";
      else if (sourceKind(model.source) === "direct" && !model.tarif) message = "Indiquez le tarif total.";
      else if ((model.poolOffert || model.jacuzziOffert) && nights < 1) message = "Indiquez les dates pour le chauffage offert.";
      if (!message) syncOffers();
      error.textContent = message;
      if (message) return;
      var stay = withDerived(Object.assign({}, model, {
        id: calc.newId(),
        lien_actif: true,
        lien_expire_le: calc.addDays(model.departure, 3)
      }));
      persist(stay);
      window.location.href = (stay.source === "Direct" ? "email.html?id=" : "sejour.html?id=") + encodeURIComponent(stay.id);
    });
    fill();
  }

  function moneyRow(label, amountCents, negative) {
    var shown = negative ? -Math.abs(amountCents || 0) : (amountCents || 0);
    return '<p class="money-row"><span class="lbl">' + label + '</span><strong>' + esc(calc.money(shown)) + '</strong></p>';
  }

  function offersBlock(stay) {
    var offers = offerNames(stay);
    return offers.length ? '<p class="money-row"><span class="lbl">Offerts</span><strong>' + esc(offers.join(", ")) + '</strong></p>' : '';
  }

  function priceBlock(stay) {
    var nights = stay.nights;
    var kind = sourceKind(stay.source);
    if (kind === "airbnb") {
      return '<section class="block"><p class="kicker">Revenus Airbnb</p>'
        + moneyRow("Frais de chambre pour " + nights + " nuits", stay.room)
        + moneyRow("Réduction", stay.reduction, true)
        + moneyRow("Frais de service hôte (15,5 % + TVA)", stay.hostFee, true)
        + moneyRow("Vous gagnez", stay.gain)
        + '<p class="hint">Recopiez ces montants depuis l’onglet Revenus d’Airbnb.</p>'
        + offersBlock(stay) + '</section>';
    }
    if (kind === "booking") {
      var people = (stay.adults || 0) + (stay.children || 0);
      return '<section class="block"><p class="kicker">Détail du tarif Booking.com</p>'
        + moneyRow("Montant total de la réservation", stay.total)
        + moneyRow("Commission", stay.commission, true)
        + moneyRow("Frais bancaires (2 %)", stay.bank, true)
        + moneyRow("Net", stay.net)
        + '<p class="tax-note"><span>Taxe de séjour 2,50' + nbsp + '€ / pers. / nuit' + nbsp + ': demandée au client sur la facture finale</span><strong>' + esc(calc.money(stay.tax || calc.bookingTax(people, nights))) + '</strong></p>'
        + offersBlock(stay) + '</section>';
    }
    return '<section class="block"><p class="kicker">' + (stay.source === "Direct" ? "Tarif direct" : "Tarif " + esc(sourceLabel(stay))) + '</p>'
      + moneyRow("Tarif total", stay.tarif)
      + moneyRow("Acompte reçu", stay.deposit)
      + '<p class="money-row"><span class="lbl">Acompte</span><strong>' + esc(calc.dayText(stay.depositDate, true) + " · " + (stay.depositMode || "")) + '</strong></p>'
      + moneyRow("Reste à payer", stay.due)
      + offersBlock(stay)
      + '</section>';
  }

  function heatBlock(stay) {
    if (!(stay.poolDays > 0) && !(stay.jacuzziDays > 0)) return "";
    function line(label, days, rate, offert) {
      if (!(days > 0)) return "";
      var text = offert ? (days + " nuit" + (days > 1 ? "s" : "") + " · offert") : (days + " j × " + calc.money(rate));
      return '<p class="money-row"><span class="lbl">' + label + '</span><strong>' + esc(text) + '</strong></p>';
    }
    return '<section class="block"><p class="kicker">Chauffage réservé</p>'
      + line("Piscine", stay.poolDays, stay.poolRate, stay.poolOffert)
      + line("Jacuzzi", stay.jacuzziDays, stay.jacuzziRate, stay.jacuzziOffert)
      + '</section>';
  }

  function finishedBlock(stay) {
    var status = calc.statusOf(stay.arrival, stay.departure, calc.todayIso());
    if (status !== "fini") return "";
    var items = stay.demandes || [];
    var due = 0;
    items.forEach(function (item) {
      if (item.status === "Terminée") due += item.amount || 0;
    });
    if (sourceKind(stay.source) === "booking") due += stay.tax || 0;
    if (!stay.poolOffert && stay.poolDays) due += stay.poolDays * (stay.poolRate || 0);
    if (!stay.jacuzziOffert && stay.jacuzziDays) due += stay.jacuzziDays * (stay.jacuzziRate || 0);
    var list = items.map(function (item) {
      return '<p class="demand-line"><span>' + esc(item.label) + ' · ' + esc(item.status) + '</span><b>' + (item.amount ? esc(calc.money(item.amount)) : "") + '</b></p>';
    }).join("");
    var taxLine = sourceKind(stay.source) === "booking"
      ? '<p class="cash-line"><span>Taxe de séjour (2,50' + nbsp + '€ × pers. × nuits)</span><b>' + esc(calc.money(stay.tax || 0)) + '</b></p>'
      : "";
    return '<section class="block"><p class="kicker">Demandes</p>' + (list || '<p class="note">Aucune demande.</p>')
      + '</section><section class="block"><p class="kicker">Encaissement</p>' + taxLine
      + '<p class="cash-line"><span>À encaisser</span><b>' + esc(calc.money(due)) + '</b></p></section>';
  }

  function bootFiche() {
    var root = document.querySelector("[data-fiche]");
    if (!root) return;
    var id = "";
    try { id = new URLSearchParams(window.location.search).get("id") || ""; } catch (e) {}
    var stay = findStay(id);
    if (!stay) {
      root.innerHTML = '<p class="empty">Ce séjour est introuvable.</p>';
      return;
    }
    var status = calc.statusOf(stay.arrival, stay.departure, calc.todayIso());
    var active = stay.lien_actif !== false;
    root.innerHTML = '<a class="back" href="sejours.html">‹ Séjours</a>'
      + '<div class="who"><h1>' + esc(stay.nom) + '</h1><span class="chips"><span class="chip ' + chipClass(status) + '">' + chipLabel(status) + '</span><span class="chip is-source">' + esc(sourceLabel(stay)) + '</span></span></div>'
      + '<p class="meta-line">' + esc(calc.dayText(stay.arrival, true) + " → " + calc.dayText(stay.departure, true)) + '</p>'
      + '<p class="meta-line">' + esc(composition(stay) + " · " + stay.nights + " nuits") + '</p>'
      + priceBlock(stay)
      + heatBlock(stay)
      + '<a class="primary" href="encaissement.html?sejour=' + encodeURIComponent(stay.id) + '">Encaisser</a>'
      + (stay.notes ? '<section class="block"><p class="kicker">Notes</p><p>' + esc(stay.notes) + '</p></section>' : '')
      + '<section class="block" data-link-card><p class="kicker">Lien du portail invité</p>'
      + '<p class="link-url">' + esc(portalUrl(stay.id)).replace("?stay=", "<wbr>?stay=") + '</p>'
      + '<p class="link-until">' + (active ? ("Lien actif jusqu’au " + esc(calc.dayText(stay.lien_expire_le, true))) : "Lien désactivé") + '</p>'
      + '<div class="link-actions"><button type="button" data-prolong>Prolonger</button><button type="button" class="is-quiet" data-stop>Désactiver</button></div>'
      + '<button type="button" class="ghost" data-copy>Copier le lien</button>'
      + '<a class="wa" data-wa href="' + esc(waHref(stay)) + '">Envoyer par WhatsApp</a>'
      + '</section>'
      + finishedBlock(stay);

    var prolong = root.querySelector("[data-prolong]");
    var stop = root.querySelector("[data-stop]");
    var copy = root.querySelector("[data-copy]");
    if (prolong) prolong.addEventListener("click", function () {
      var base = stay.lien_expire_le || calc.addDays(stay.departure, 3);
      var today = calc.todayIso();
      if (base < today) base = today;
      patchStay(stay.id, { lien_expire_le: calc.addDays(base, 7), lien_actif: true }, "prolong");
      bootFiche();
    });
    if (stop) stop.addEventListener("click", function () {
      patchStay(stay.id, { lien_actif: false }, "deactivate");
      bootFiche();
    });
    if (copy) copy.addEventListener("click", function () {
      var url = portalUrl(stay.id);
      var done = function () { copy.textContent = "Lien copié"; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url); done(); });
      } else { fallbackCopy(url); done(); }
    });
  }

  function fallbackCopy(url) {
    var area = document.createElement("textarea");
    area.value = url;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch (e) {}
    area.remove();
  }

  function emailBody(stay) {
    var offers = offerNames(stay);
    var lines = [
      "Bonjour " + firstName(stay.nom) + ",",
      "",
      "Votre réservation est confirmée.",
      "",
      "Arrivée : " + calc.dayText(stay.arrival, true),
      "Départ : " + calc.dayText(stay.departure, true),
      "Voyageurs : " + composition(stay),
      "",
      "Tarif : " + calc.money(stay.tarif),
      "Acompte reçu : " + calc.money(stay.deposit) + " le " + calc.dayText(stay.depositDate, true) + ", par " + String(stay.depositMode || "").toLowerCase(),
      "Reste à payer : " + calc.money(stay.due) + ", soit " + calc.dirhams(stay.due) + ", en espèces (euros ou dirhams) ou par PayPal."
    ];
    if (offers.length) lines.push("", "Offert pour votre séjour : " + offers.join(", ") + ".");
    lines.push("", "Votre espace invité :", portalUrl(stay.id), "Lien actif jusqu’au " + calc.dayText(stay.lien_expire_le, true) + ".", "", "Mehdi · Villa Zen’O");
    return lines.join("\n");
  }

  function bootEmail() {
    var root = document.querySelector("[data-email]");
    if (!root) return;
    var id = "";
    try { id = new URLSearchParams(window.location.search).get("id") || ""; } catch (e) {}
    var stay = findStay(id);
    if (!stay || stay.source !== "Direct") {
      root.innerHTML = '<p class="empty">Cet e-mail concerne une réservation directe.</p>';
      return;
    }
    var body = emailBody(stay);
    var gmail = "https://mail.google.com/mail/?view=cm&fs=1&su="
      + encodeURIComponent("Votre séjour à la Villa Zen’O")
      + "&body=" + encodeURIComponent(body);
    var html = body.split("\n").map(function (line) {
      if (!line) return '<p class="gap"></p>';
      return "<p>" + esc(line).replace(/ :/g, "\u00A0:") + "</p>";
    }).join("");
    root.innerHTML = '<a class="back" href="sejour.html?id=' + esc(stay.id) + '">‹ Fiche séjour</a>'
      + '<h1>E-mail de confirmation</h1>'
      + '<article class="letter">' + html.replace("<p>Mehdi · Villa Zen’O</p>", '<p class="sign">Mehdi · Villa Zen’O</p>') + '</article>'
      + '<a class="primary" data-gmail href="' + esc(gmail) + '" target="_blank" rel="noopener">Ouvrir dans Gmail</a>';
  }

  function boot() {
    if (document.body.classList.contains("is-locked")) return;
    var page = document.body.getAttribute("data-page");
    if (page === "liste") bootList();
    if (page === "nouveau") bootForm();
    if (page === "fiche") loadStays(bootFiche);
    if (page === "email") loadStays(bootEmail);
  }

  window.AdminStays = { find: findStay, load: loadStays, all: allStays, sourceLabel: sourceLabel, channelOf: channelOf, sheet: sheetStay, post: postScript };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
