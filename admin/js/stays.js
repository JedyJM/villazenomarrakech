/* Séjours: list, new stay, fiche, confirmation email. French. TEST_MODE uses the example stays. */
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
  function examples() {
    return [
      {
        id: "cmartin26a",
        nom: "Camille Martin",
        telephone: "+33 6 12 00 00 01",
        arrival: "2026-12-12",
        departure: "2026-12-19",
        source: "Airbnb",
        adults: 2,
        children: 2,
        ages: [8, 3],
        notes: "",
        room: 220600,
        reduction: 33090,
        hostFee: 34877,
        poolDays: 0, poolRate: 0, poolOffert: false,
        jacuzziDays: 0, jacuzziRate: 0, jacuzziOffert: false,
        lien_actif: true
      },
      {
        id: "jroche26bk",
        nom: "Julien Roche",
        telephone: "+33 6 12 00 00 02",
        arrival: "2026-11-20",
        departure: "2026-11-27",
        source: "Booking",
        adults: 3,
        children: 2,
        ages: [],
        notes: "",
        total: 672770,
        commission: 166005,
        bank: 13280,
        poolDays: 0, poolRate: 0, poolOffert: false,
        jacuzziDays: 0, jacuzziRate: 0, jacuzziOffert: false,
        lien_actif: true
      },
      {
        id: "imoreau26d",
        nom: "Inès Moreau",
        telephone: "+33 6 12 00 00 03",
        arrival: "2026-12-22",
        departure: "2026-12-29",
        source: "Direct",
        adults: 2,
        children: 0,
        ages: [],
        notes: "",
        tarif: 320000,
        deposit: 100000,
        depositDate: "2026-12-10",
        depositMode: "Virement",
        breakfast: true,
        poolDays: 0, poolRate: 0, poolOffert: true,
        jacuzziDays: 0, jacuzziRate: 0, jacuzziOffert: false,
        lien_actif: true
      }
    ];
  }

  function finishExample() {
    return {
      id: "__fini",
      nom: "Séjour terminé",
      telephone: "+33 6 12 00 00 09",
      arrival: "2026-10-01",
      departure: "2026-10-08",
      source: "Booking",
      adults: 2,
      children: 0,
      ages: [],
      notes: "",
      total: 200000,
      commission: 30000,
      bank: 4000,
      poolDays: 2, poolRate: 6000, poolOffert: false,
      jacuzziDays: 0, jacuzziRate: 0, jacuzziOffert: false,
      lien_actif: true,
      hidden: true,
      demandes: [
        { label: "Déjeuner", detail: "4 pers.", status: "Terminée", amount: 8000 },
        { label: "Ménage", detail: "Toute la maison", status: "Annulée", amount: 0 }
      ]
    };
  }

  function withDerived(stay) {
    var copy = Object.assign({}, stay);
    copy.nights = calc.nights(copy.arrival, copy.departure);
    if (!copy.lien_expire_le) copy.lien_expire_le = calc.addDays(copy.departure, 3);
    if (copy.source === "Airbnb") copy.gain = calc.airbnbGain(copy.room, copy.reduction, copy.hostFee);
    if (copy.source === "Booking") {
      copy.net = calc.bookingNet(copy.total, copy.commission, copy.bank);
      copy.tax = calc.bookingTax((copy.adults || 0) + (copy.children || 0), copy.nights);
    }
    if (copy.source === "Direct") copy.due = calc.directDue(copy.tarif, copy.deposit);
    return copy;
  }

  function allStays() {
    var base = shell.TEST_MODE ? examples() : [];
    var created = readJson(STORE) || [];
    var patches = readJson(PATCH) || {};
    var merged = base.concat(created).map(function (stay) {
      return withDerived(Object.assign({}, stay, patches[stay.id] || {}));
    });
    if (shell.TEST_MODE) merged.push(withDerived(finishExample()));
    return merged;
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
    postScript({ action: "save-stay", test: "1", stay: sheetStay(stay) });
  }

  function patchStay(id, fields, op) {
    var patches = readJson(PATCH) || {};
    patches[id] = Object.assign({}, patches[id] || {}, fields);
    try { sessionStorage.setItem(PATCH, JSON.stringify(patches)); } catch (e) {}
    postScript({ action: "stay-link", test: "1", id: id, op: op });
  }

  function sheetStay(stay) {
    return {
      booking_id: stay.id,
      nom: stay.nom,
      telephone: stay.telephone,
      date_arrivee: stay.arrival,
      date_depart: stay.departure,
      source: stay.source,
      adultes: stay.adults,
      enfants: stay.children,
      ages_enfants: (stay.ages || []).join(","),
      notes: stay.notes || "",
      lien_actif: stay.lien_actif !== false,
      lien_expire_le: stay.lien_expire_le || calc.addDays(stay.departure, 3),
      airbnb_frais_chambre: stay.source === "Airbnb" ? (stay.room || 0) / 100 : "",
      airbnb_reduction: stay.source === "Airbnb" ? (stay.reduction || 0) / 100 : "",
      airbnb_frais_service: stay.source === "Airbnb" ? (stay.hostFee || 0) / 100 : "",
      airbnb_gain: stay.source === "Airbnb" ? (stay.gain || 0) / 100 : "",
      booking_montant: stay.source === "Booking" ? (stay.total || 0) / 100 : "",
      booking_commission: stay.source === "Booking" ? (stay.commission || 0) / 100 : "",
      booking_frais_bancaires: stay.source === "Booking" ? (stay.bank || 0) / 100 : "",
      booking_net: stay.source === "Booking" ? (stay.net || 0) / 100 : "",
      direct_tarif: stay.source === "Direct" ? (stay.tarif || 0) / 100 : "",
      acompte_montant: stay.source === "Direct" ? (stay.deposit || 0) / 100 : "",
      acompte_date: stay.depositDate || "",
      acompte_mode: stay.depositMode || "",
      reste_a_payer: stay.source === "Direct" ? (stay.due || 0) / 100 : "",
      offert_petit_dejeuner: !!stay.breakfast,
      chauffage_piscine_jours: stay.poolDays || 0,
      chauffage_piscine_tarif_eur: stay.poolRate ? stay.poolRate / 100 : 0,
      chauffage_piscine_offert: !!stay.poolOffert,
      chauffage_jacuzzi_jours: stay.jacuzziDays || 0,
      chauffage_jacuzzi_tarif_eur: stay.jacuzziRate ? stay.jacuzziRate / 100 : 0,
      chauffage_jacuzzi_offert: !!stay.jacuzziOffert
    };
  }

  function postScript(payload) {
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
    return window.location.origin + "/guest/?stay=" + encodeURIComponent(id);
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

  function bootList() {
    var list = document.querySelector("[data-list]");
    var year = document.querySelector("[data-year]");
    var empty = document.querySelector("[data-empty]");
    if (!list || !year) return;
    var current = calc.todayIso().slice(0, 4);
    [String(Number(current) - 1), current, String(Number(current) + 1)].forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (value === current) option.selected = true;
      year.appendChild(option);
    });
    function paint() {
      var selected = year.value;
      var rows = allStays().filter(function (stay) {
        return !stay.hidden && String(stay.arrival || "").slice(0, 4) === selected;
      });
      var order = { cours: 0, venir: 1, fini: 2 };
      rows.sort(function (a, b) {
        var sa = calc.statusOf(a.arrival, a.departure, calc.todayIso());
        var sb = calc.statusOf(b.arrival, b.departure, calc.todayIso());
        if (order[sa] !== order[sb]) return order[sa] - order[sb];
        return String(a.arrival).localeCompare(String(b.arrival));
      });
      empty.hidden = rows.length > 0;
      empty.textContent = "Aucun séjour en " + selected + ".";
      list.hidden = !rows.length;
      list.innerHTML = rows.map(function (stay) {
        var status = calc.statusOf(stay.arrival, stay.departure, calc.todayIso());
        return '<a class="stay-row" href="sejour.html?id=' + esc(stay.id) + '">'
          + '<span class="stay-top"><span class="stay-name">' + esc(stay.nom) + '</span>'
          + '<span class="chip ' + chipClass(status) + '">' + chipLabel(status) + '</span></span>'
          + '<span class="stay-sub"><span class="stay-meta">' + esc(calc.rangeLabel(stay.arrival, stay.departure) + " · " + peopleBits(stay)) + '</span>'
          + '<span class="stay-source">' + esc(stay.source) + '</span></span>'
          + '<span class="chev" aria-hidden="true">›</span></a>';
      }).join("");
    }
    year.addEventListener("change", paint);
    paint();
  }

  function blank() {
    return {
      nom: "", telephone: "", arrival: "", departure: "", source: "Airbnb",
      adults: 2, children: 0, ages: [], notes: "",
      room: 0, reduction: 0, hostFee: 0,
      total: 0, commission: 0, bank: 0,
      tarif: 0, deposit: 0, depositDate: "", depositMode: "Virement",
      breakfast: false, poolOffert: false, jacuzziOffert: false,
      poolDays: 0, poolRate: 0, jacuzziDays: 0, jacuzziRate: 0
    };
  }

  function fromExample(key) {
    var map = { airbnb: "cmartin26a", booking: "jroche26bk", direct: "imoreau26d" };
    var stay = findStay(map[key]);
    if (!stay) return blank();
    var copy = Object.assign(blank(), stay);
    delete copy.id;
    return copy;
  }

  function bootForm() {
    var form = document.querySelector("[data-stay-form]");
    if (!form) return;
    var model = blank();
    var exemple = "";
    try { exemple = new URLSearchParams(window.location.search).get("exemple") || ""; } catch (e) {}
    if (exemple) model = fromExample(exemple);
    var agesBox = form.querySelector("[data-ages]");
    var price = form.querySelector("[data-price]");
    var save = form.querySelector("[data-save]");
    var error = form.querySelector("[data-error]");

    function field(name) { return form.querySelector("[name='" + name + "']"); }

    function readCommon() {
      model.nom = field("nom").value.trim();
      model.telephone = field("telephone").value.trim();
      model.arrival = field("arrival").value;
      model.departure = field("departure").value;
      model.notes = field("notes").value.trim();
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
      if (model.source === "Airbnb") {
        model.room = calc.cents(price.querySelector("[name='room']").value);
        model.reduction = calc.cents(price.querySelector("[name='reduction']").value);
        model.hostFee = calc.cents(price.querySelector("[name='hostFee']").value);
      } else if (model.source === "Booking") {
        model.total = calc.cents(price.querySelector("[name='total']").value);
        model.commission = calc.cents(price.querySelector("[name='commission']").value);
        model.bank = calc.cents(price.querySelector("[name='bank']").value);
      } else {
        model.tarif = calc.cents(price.querySelector("[name='tarif']").value);
        model.deposit = calc.cents(price.querySelector("[name='deposit']").value);
        model.depositDate = price.querySelector("[name='depositDate']").value;
        model.breakfast = price.querySelector("[name='breakfast']").checked;
        model.poolOffert = price.querySelector("[name='poolOffert']").checked;
        model.jacuzziOffert = price.querySelector("[name='jacuzziOffert']").checked;
        price.querySelectorAll("[data-mode]").forEach(function (button) {
          if (button.getAttribute("aria-pressed") === "true") model.depositMode = button.getAttribute("data-mode");
        });
      }
    }

    function amountInput(name, label, value, negative) {
      var shown = value ? (value / 100).toFixed(2).replace(".", ",") : "";
      var fieldHtml = '<input name="' + name + '" inputmode="decimal" autocomplete="off" value="' + esc(shown) + '">';
      if (negative) fieldHtml = '<span class="signed"><i>−</i>' + fieldHtml + '</span>';
      return '<label class="money-row' + (negative ? ' is-neg' : '') + '"><span class="lbl">' + label + '</span>' + fieldHtml + '</label>';
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
      if (model.source === "Airbnb") {
        var gain = calc.airbnbGain(model.room, model.reduction, model.hostFee);
        html = '<p class="kicker">Revenus Airbnb</p>'
          + amountInput("room", "Frais de chambre pour " + nightLabel + nightWord, model.room)
          + amountInput("reduction", "Réduction", model.reduction, true)
          + amountInput("hostFee", "Frais de service hôte (15,5 % + TVA)", model.hostFee, true)
          + '<p class="money-row"><span class="lbl">Vous gagnez</span><strong data-out>' + esc(calc.money(gain)) + '</strong></p>'
          + '<p class="hint">Recopiez ces montants depuis l’onglet Revenus d’Airbnb.</p>';
      } else if (model.source === "Booking") {
        var net = calc.bookingNet(model.total, model.commission, model.bank);
        var people = (model.adults || 0) + (model.children || 0);
        var tax = calc.bookingTax(people, nights);
        html = '<p class="kicker">Détail du tarif Booking</p>'
          + amountInput("total", "Montant total de la réservation", model.total)
          + amountInput("commission", "Commission", model.commission, true)
          + amountInput("bank", "Frais bancaires (2 %)", model.bank, true)
          + '<p class="money-row"><span class="lbl">Net</span><strong data-out>' + esc(calc.money(net)) + '</strong></p>'
          + '<p class="tax-note"><span>Taxe de séjour 2,50' + nbsp + '€ / pers. / nuit' + nbsp + ': demandée au client sur la facture finale</span><strong data-tax>' + esc(calc.money(tax)) + '</strong></p>';
      } else {
        var due = calc.directDue(model.tarif, model.deposit);
        html = '<p class="kicker">Tarif direct</p>'
          + amountInput("tarif", "Tarif total", model.tarif)
          + amountInput("deposit", "Acompte reçu", model.deposit)
          + '<label class="money-row"><span class="lbl">Date de l’acompte</span><input type="date" name="depositDate" value="' + esc(model.depositDate) + '"></label>'
          + '<div class="modes" role="group" aria-label="Mode de l’acompte">'
          + ["Virement", "Espèces", "PayPal"].map(function (mode) {
            var on = model.depositMode === mode;
            return '<button type="button" data-mode="' + mode + '" aria-pressed="' + (on ? "true" : "false") + '">' + mode + '</button>';
          }).join("")
          + '</div>'
          + '<p class="money-row"><span class="lbl">Reste à payer</span><strong data-out>' + esc(calc.money(due)) + '</strong></p>'
          + '<p class="kicker">Offerts</p>'
          + '<div class="offers">'
          + offerBox("breakfast", "Petit-déjeuner", model.breakfast)
          + offerBox("poolOffert", "Chauffage piscine", model.poolOffert)
          + offerBox("jacuzziOffert", "Chauffage jacuzzi", model.jacuzziOffert)
          + '</div>';
      }
      price.innerHTML = html;
      save.textContent = model.source === "Direct" ? "Préparer l’e-mail de confirmation" : "Enregistrer le séjour";
    }

    function offerBox(name, label, on) {
      return '<label><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + '>' + label + '</label>';
    }

    function readPriceSafe() {
      if (price.querySelector("input, button")) readPrice();
    }

    function paintSource() {
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
    }

    function fill() {
      field("nom").value = model.nom;
      field("telephone").value = model.telephone;
      field("arrival").value = model.arrival;
      field("departure").value = model.departure;
      field("notes").value = model.notes || "";
      field("poolRate").value = model.poolRate ? String(model.poolRate / 100).replace(".", ",") : "";
      field("jacuzziRate").value = model.jacuzziRate ? String(model.jacuzziRate / 100).replace(".", ",") : "";
      paintSource();
      paintSteps();
      paintAges();
      paintPrice();
    }

    form.addEventListener("click", function (event) {
      var source = event.target.closest("[data-source]");
      if (source) {
        readCommon();
        readPriceSafe();
        model.source = source.getAttribute("data-source");
        paintSource();
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
        if (key === "poolDays") model.poolDays = Math.max(0, Math.min(30, model.poolDays + dir));
        if (key === "jacuzziDays") model.jacuzziDays = Math.max(0, Math.min(30, model.jacuzziDays + dir));
        paintSteps();
        if (model.source === "Airbnb" || model.source === "Booking") paintPrice();
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
      if (event.target.name === "arrival" || event.target.name === "departure") {
        readCommon();
        readPriceSafe();
        paintPrice();
        return;
      }
      if (!price.contains(event.target)) return;
      readPriceSafe();
      var out = price.querySelector("[data-out]");
      var nights = calc.nights(model.arrival, model.departure);
      if (model.source === "Airbnb" && out) out.textContent = calc.money(calc.airbnbGain(model.room, model.reduction, model.hostFee));
      else if (model.source === "Booking") {
        if (out) out.textContent = calc.money(calc.bookingNet(model.total, model.commission, model.bank));
        var taxNode = price.querySelector("[data-tax]");
        if (taxNode) taxNode.textContent = calc.money(calc.bookingTax((model.adults || 0) + (model.children || 0), nights));
      } else if (out) out.textContent = calc.money(calc.directDue(model.tarif, model.deposit));
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
      else if (model.source === "Airbnb" && !model.room) message = "Indiquez les frais de chambre.";
      else if (model.source === "Booking" && !model.total) message = "Indiquez le montant total.";
      else if (model.source === "Direct" && !model.tarif) message = "Indiquez le tarif total.";
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

  function priceBlock(stay) {
    var nights = stay.nights;
    if (stay.source === "Airbnb") {
      return '<section class="block"><p class="kicker">Revenus Airbnb</p>'
        + moneyRow("Frais de chambre pour " + nights + " nuits", stay.room)
        + moneyRow("Réduction", stay.reduction, true)
        + moneyRow("Frais de service hôte (15,5 % + TVA)", stay.hostFee, true)
        + moneyRow("Vous gagnez", stay.gain)
        + '<p class="hint">Recopiez ces montants depuis l’onglet Revenus d’Airbnb.</p></section>';
    }
    if (stay.source === "Booking") {
      var people = (stay.adults || 0) + (stay.children || 0);
      return '<section class="block"><p class="kicker">Détail du tarif Booking</p>'
        + moneyRow("Montant total de la réservation", stay.total)
        + moneyRow("Commission", stay.commission, true)
        + moneyRow("Frais bancaires (2 %)", stay.bank, true)
        + moneyRow("Net", stay.net)
        + '<p class="tax-note"><span>Taxe de séjour 2,50' + nbsp + '€ / pers. / nuit' + nbsp + ': demandée au client sur la facture finale</span><strong>' + esc(calc.money(stay.tax || calc.bookingTax(people, nights))) + '</strong></p></section>';
    }
    var offers = offerNames(stay);
    return '<section class="block"><p class="kicker">Tarif direct</p>'
      + moneyRow("Tarif total", stay.tarif)
      + moneyRow("Acompte reçu", stay.deposit)
      + '<p class="money-row"><span class="lbl">Acompte</span><strong>' + esc(calc.dayText(stay.depositDate, true) + " · " + (stay.depositMode || "")) + '</strong></p>'
      + moneyRow("Reste à payer", stay.due)
      + (offers.length ? '<p class="money-row"><span class="lbl">Offerts</span><strong>' + esc(offers.join(", ")) + '</strong></p>' : '')
      + '</section>';
  }

  function heatBlock(stay) {
    if (!stay.poolDays && !stay.jacuzziDays && !stay.poolOffert && !stay.jacuzziOffert) return "";
    function line(label, days, rate, offert) {
      if (!days && !offert) return "";
      var text = days ? (days + " j × " + calc.money(rate)) : "offert";
      if (offert && days) text += " · offert";
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
    if (stay.source === "Booking") due += stay.tax || 0;
    if (!stay.poolOffert && stay.poolDays) due += stay.poolDays * (stay.poolRate || 0);
    if (!stay.jacuzziOffert && stay.jacuzziDays) due += stay.jacuzziDays * (stay.jacuzziRate || 0);
    var list = items.map(function (item) {
      return '<p class="demand-line"><span>' + esc(item.label) + ' · ' + esc(item.status) + '</span><b>' + (item.amount ? esc(calc.money(item.amount)) : "") + '</b></p>';
    }).join("");
    var taxLine = stay.source === "Booking"
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
      + '<div class="who"><h1>' + esc(stay.nom) + '</h1><span class="chip ' + chipClass(status) + '">' + chipLabel(status) + '</span></div>'
      + '<p class="meta-line">' + esc(calc.dayText(stay.arrival, true) + " → " + calc.dayText(stay.departure, true)) + '</p>'
      + '<p class="meta-line">' + esc(composition(stay) + " · " + stay.nights + " nuits") + '</p>'
      + '<div class="chips"><span class="chip is-source">' + esc(stay.source) + '</span></div>'
      + priceBlock(stay)
      + heatBlock(stay)
      + (stay.notes ? '<section class="block"><p class="kicker">Notes</p><p>' + esc(stay.notes) + '</p></section>' : '')
      + '<section class="block" data-link-card><p class="kicker">Lien du portail invité</p>'
      + '<p class="link-url">' + esc(portalUrl(stay.id)) + '</p>'
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
    if (page === "fiche") bootFiche();
    if (page === "email") bootEmail();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
