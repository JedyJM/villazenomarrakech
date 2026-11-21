/* Guest requests. Nothing is sent to the villa or to WhatsApp by this file.
   WhatsApp links are opened only when the guest taps them.
   The endpoint below is a placeholder and stays disabled. */
(function () {
  "use strict";

  var config = {
    endpoint: "",
    enabled: false,
    storageKey: "villazeno.demandes"
  };

  /* Google Apps Script web app for the sheet “Villa Zen’O – Bookings”.
     An empty value skips the sheet and keeps the request in localStorage only. */
  var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrmyFtKdhIovJAh2A-DjYfIYNwGWz7s-r_yKz8TDj29J1OcbnBPA7tIBV1qRJbtFcwlw/exec";

  /* Test routing for transfer and car-rental WhatsApp buttons only.
     Flip TEST_MODE to false to open Hicham and Massillya again.
     Meals, housekeeping, the pool and a quad always use VILLA_WHATSAPP. */
  var TEST_MODE = true;
  var TEST_WHATSAPP = VILLA_WHATSAPP;
  var RECIPIENTS = {
    hicham: "212661775422",
    massillya: "212616172974",
    activites: VILLA_WHATSAPP,
    massage: VILLA_WHATSAPP
  };

  function requestWhatsApp(realNumber, message) {
    var number = TEST_MODE ? TEST_WHATSAPP : realNumber;
    return "https://api.whatsapp.com/send?phone=" + number + "&text=" + encodeURIComponent(message);
  }

  function villaWhatsApp(message) {
    return "https://wa.me/" + String(VILLA_WHATSAPP).replace(/\D/g, "") + "?text=" + encodeURIComponent(message);
  }

  function randomBase36(length) {
    var alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    var bytes = new Uint8Array(length);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = "";
    for (var j = 0; j < length; j++) out += alphabet[bytes[j] % 36];
    return out;
  }

  function newToken() {
    return randomBase36(10);
  }

  function confirmLink(id, token) {
    return window.location.origin + "/c?r=" + encodeURIComponent(id) + "&k=" + encodeURIComponent(token);
  }

  function withStaffConfirm(message, id, token) {
    if (!APPS_SCRIPT_URL || !token) return message;
    return message + "\n\nConfirmer :\n" + confirmLink(id, token);
  }

  function sheetPayload(record, token, sousType, destinataire, rows) {
    var fields = record.fields || {};
    var details = { token: token };
    Object.keys(fields).forEach(function (key) {
      if (key !== "message") details[key] = fields[key];
    });
    if (rows && rows.length) {
      details.resume = rows.map(function (row) { return row[0] + " : " + row[1]; }).join("\n");
    }
    if (record.guest && record.guest.bookingId) details.booking_id = record.guest.bookingId;
    return {
      id: record.id,
      token: token,
      date_creation: record.created_at,
      service: record.service,
      sous_type: sousType || "",
      nom_client: staffName(record.guest),
      details: details,
      total_dh: record.total == null ? "" : record.total,
      destinataire: destinataire
    };
  }

  function postToSheet(payload) {
    if (!APPS_SCRIPT_URL || !window.fetch) return;
    try {
      window.fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
  }

  function stayId() {
    var fromQuery = "";
    try {
      fromQuery = new URLSearchParams(window.location.search).get("stay") || "";
    } catch (e) {}
    if (fromQuery) {
      try { localStorage.setItem("villazeno.stay", fromQuery); } catch (e2) {}
      return fromQuery;
    }
    try { return localStorage.getItem("villazeno.stay") || ""; } catch (e3) { return ""; }
  }

  function getGuestFromStay() {
    // Placeholder. Name and phone will be looked up from the Google Sheet
    // "Villa Zen'O – Bookings", tab Réservations, using the stay booking id.
    // The guest does not type them.
    return {
      name: isEn() ? "Guest" : "Invité",
      phone: "+212 600 000 000",
      villa: "Villa Zen’O",
      bookingId: stayId(),
      example: true,
      // Read only. Tab Réservations, never written by the portal.
      // chauffage_piscine_jours, chauffage_piscine_tarif_eur
      // chauffage_jacuzzi_jours, chauffage_jacuzzi_tarif_eur
      // days: integer, rate: euros per day. Null until the columns exist.
      heating: { pool: null, jacuzzi: null }
    };
  }

  var rates = {
    bandSmall: 350,
    bandLarge: 450,
    babySeat: 50,
    maxPassengers: 8
  };

  function isEn() {
    return (document.documentElement.lang || "fr").slice(0, 2) === "en";
  }

  function text(fr, en) {
    return isEn() ? en : fr;
  }

  function money(amount) {
    return amount + (isEn() ? "\u00A0MAD" : "\u00A0DH");
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function newId() {
    return randomBase36(8);
  }


  function vehicleLoads(passengers, vehicles) {
    var n = Math.max(0, Number(passengers) || 0);
    if (vehicles !== 2) return [n];
    return [Math.ceil(n / 2), Math.floor(n / 2)];
  }

  function bandAmount(count) {
    if (count <= 0) return 0;
    return count <= 4 ? rates.bandSmall : rates.bandLarge;
  }

  function quote(passengers, babyQty, vehicles) {
    var n = Number(passengers);
    var v = Number(vehicles) === 2 ? 2 : 1;
    if (!n) return { ready: false, prompt: false, vehicles: v, loads: [] };
    var prompt = v === 1 && n > rates.maxPassengers;
    var loads = prompt ? [] : vehicleLoads(Math.min(n, rates.maxPassengers * v), v);
    var base = loads.reduce(function (sum, count) { return sum + bandAmount(count); }, 0);
    var qty = Math.max(0, Math.min(3, Number(babyQty) || 0));
    var amount = qty * rates.babySeat;
    return {
      ready: true,
      prompt: prompt,
      vehicles: v,
      loads: loads,
      price_base: prompt ? null : base,
      supplements: qty ? [{ code: "baby_seat", quantity: qty, unit_mad: rates.babySeat, amount_mad: amount }] : [],
      total: prompt ? null : base + amount,
      currency: "MAD"
    };
  }

  var monthsFr = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    var month = (isEn() ? monthsEn : monthsFr)[Number(parts[1]) - 1];
    return Number(parts[2]) + " " + month + " " + parts[0];
  }

  function formatDateFr(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    return Number(parts[2]) + " " + monthsFr[Number(parts[1]) - 1] + " " + parts[0];
  }

  function moneyFr(amount) {
    return amount + " DH";
  }

  function staffName(guest) {
    if (!guest || guest.example || guest.name === "Guest") return "Invité";
    return guest.name;
  }

  function paintPicker(input) {
    var display = input.parentElement.querySelector("[data-picker-value]");
    if (!display) return;
    if (!input.value) {
      display.textContent = input.type === "date" ? text("jj/mm/aaaa", "dd/mm/yyyy") : "hh:mm";
      display.classList.add("is-empty");
      return;
    }
    display.classList.remove("is-empty");
    display.textContent = input.type === "date" ? formatDate(input.value) : input.value.slice(0, 5);
  }

  function breakdown(q) {
    if (!q.ready || q.prompt) return "";
    var head = q.vehicles === 2
      ? text("2 véhicules · " + q.loads[0] + "+" + q.loads[1] + " pers. ", "2 cars · " + q.loads[0] + "+" + q.loads[1] + " guests ")
      : text("1 véhicule · " + (q.loads[0] <= 4 ? "1–4" : "5–8") + " pers. ", "1 car · " + (q.loads[0] <= 4 ? "1–4" : "5–8") + " guests ");
    var line = head + money(q.price_base);
    if (q.supplements.length) {
      var qty = q.supplements[0].quantity;
      var seats = qty > 1
        ? text(qty + " sièges bébé ", qty + " baby seats ")
        : text("1 siège bébé ", "1 baby seat ");
      line += " + " + seats + money(q.supplements[0].amount_mad);
    }
    return line;
  }

  function renderPrice(box, q) {
    if (!box) return;
    var total = box.querySelector("[data-price-total]");
    var line = box.querySelector("[data-price-break]");
    if (!q.ready) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (q.prompt) {
      total.textContent = text("Pour plus de 8 passagers, passez à 2 véhicules.", "For more than 8 guests, please add a second car.");
      line.hidden = true;
      return;
    }
    total.textContent = "Total " + money(q.total);
    line.hidden = false;
    line.textContent = breakdown(q);
  }

  function saveLocal(record) {
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(config.storageKey) || "[]");
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    list.push(record);
    localStorage.setItem(config.storageKey, JSON.stringify(list));
  }

  function submitRequest(record) {
    saveLocal(record);
    if (!config.enabled || !config.endpoint) {
      return { stored: true, sent: false };
    }
    return { stored: true, sent: false };
  }

  function baseRecord(service, guest, fields, price) {
    return {
      id: newId(),
      created_at: new Date().toISOString(),
      service: service,
      status: "nouvelle",
      guest: guest,
      fields: fields,
      price_base: price && !price.blocked ? price.price_base : null,
      supplements: price && price.supplements ? price.supplements : [],
      total: price && !price.blocked ? price.total : null,
      currency: "MAD"
    };
  }

  function selectedTrip(form) {
    var picked = form.querySelector("input[name='trip']:checked");
    return picked ? picked.value : "";
  }

  function setInvalid(form, name, on) {
    var el = form.querySelector("[name='" + name + "']");
    if (el) el.setAttribute("aria-invalid", on ? "true" : "false");
  }

  function clearInvalid(form) {
    form.querySelectorAll("[aria-invalid]").forEach(function (el) {
      el.setAttribute("aria-invalid", "false");
    });
  }

  function showError(node, message) {
    if (!node) return;
    if (!message) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = message;
  }

  function babySeats(form) {
    if (!form.querySelector("[name='baby_seat']").checked) return 0;
    var n = Number(form.querySelector("[name='baby_seats']").value) || 1;
    return Math.max(1, Math.min(3, n));
  }

  function readTransfer(form) {
    var trip = selectedTrip(form);
    var babyQty = babySeats(form);
    var passengers = form.querySelector("[name='passengers']").value;
    var vehicles = Number(form.querySelector("[name='vehicles']").value) || 1;
    var price = quote(passengers, babyQty, vehicles);
    var originEl = form.querySelector("[name='origin_city']");
    var villaEl = form.querySelector("[name='villa']");
    var flightRow = form.querySelector("[data-flight-row]");
    var askFlight = !flightRow || !flightRow.hidden;
    var origin = askFlight && originEl ? originEl.value.trim() : "";
    var villa = villaEl ? villaEl.value.trim() : "";
    var fields = {
      trip_type: trip,
      date: form.querySelector("[name='date']").value,
      flight_arrival_time: trip === "arrival" ? form.querySelector("[name='time']").value : "",
      pickup_time: trip === "departure" ? form.querySelector("[name='time']").value : "",
      passengers: Number(passengers) || null,
      luggage: form.querySelector("[name='luggage']").value === "" ? null : Number(form.querySelector("[name='luggage']").value),
      flight_number: askFlight ? form.querySelector("[name='flight_number']").value.trim() : "",
      origin_city: origin,
      arrival_villa: originEl ? "" : (trip === "arrival" ? villa : ""),
      pickup_villa: originEl ? "" : (trip === "departure" ? villa : ""),
      vehicles: vehicles,
      baby_seat: babyQty > 0,
      baby_seats: babyQty,
      comment: form.querySelector("[name='comment']").value.trim()
    };
    return { fields: fields, price: price, guest: getGuestFromStay() };
  }

  function validateTransfer(form) {
    clearInvalid(form);
    var trip = selectedTrip(form);
    var date = form.querySelector("[name='date']").value;
    var time = form.querySelector("[name='time']").value;
    var passengers = form.querySelector("[name='passengers']").value;
    var luggage = form.querySelector("[name='luggage']").value;
    var flightRow = form.querySelector("[data-flight-row]");
    var askFlight = !flightRow || !flightRow.hidden;
    var flight = askFlight ? form.querySelector("[name='flight_number']").value.trim() : "x";
    var originEl = form.querySelector("[name='origin_city']");
    var villaEl = form.querySelector("[name='villa']");
    var origin = originEl ? originEl.value.trim() : "";
    var villa = villaEl ? villaEl.value.trim() : "";
    if (trip !== "arrival" && trip !== "departure") {
      return text("Veuillez choisir une arrivée ou un départ.", "Please choose arrival or departure.");
    }
    if (!date || date < todayISO()) {
      setInvalid(form, "date", true);
      return text("Veuillez indiquer une date à venir.", "Please choose a future date.");
    }
    if (!time) {
      setInvalid(form, "time", true);
      return trip === "arrival"
        ? text("Veuillez indiquer l’heure d’arrivée du vol.", "Please add the arrival time.")
        : text("Veuillez indiquer l’heure de prise en charge.", "Please add the pickup time.");
    }
    if (!passengers) {
      setInvalid(form, "passengers", true);
      return text("Veuillez indiquer le nombre de passagers.", "Please add the number of guests.");
    }
    if ((Number(form.querySelector("[name='vehicles']").value) || 1) === 1 && Number(passengers) > rates.maxPassengers) {
      return text("Pour plus de 8 passagers, passez à 2 véhicules.", "For more than 8 guests, please add a second car.");
    }
    if (luggage === "" || Number(luggage) < 0) {
      setInvalid(form, "luggage", true);
      return text("Veuillez indiquer le nombre de bagages.", "Please add the number of bags.");
    }
    if (askFlight && !flight) {
      setInvalid(form, "flight_number", true);
      return text("Veuillez indiquer le numéro de vol.", "Please add the flight number.");
    }
    if (askFlight && originEl) {
      if (!origin) {
        setInvalid(form, "origin_city", true);
        return trip === "arrival"
          ? text("Veuillez indiquer la ville de provenance.", "Please add the city you're flying from.")
          : text("Veuillez indiquer la destination.", "Please add the destination.");
      }
    } else if (villaEl && !villa) {
      setInvalid(form, "villa", true);
      return trip === "arrival"
        ? text("Indiquez la villa d’arrivée.", "Enter the arrival villa.")
        : text("Indiquez la villa de départ.", "Enter the departure villa.");
    }
    return "";
  }

  function syncTransfer(form) {
    var trip = selectedTrip(form);
    var timeLabel = form.querySelector("[data-time-label]");
    var villaLabel = form.querySelector("[data-villa-label]");
    if (timeLabel) {
      timeLabel.textContent = trip === "arrival"
        ? text("Heure d’arrivée du vol", "Arrival time")
        : text("Heure de prise en charge", "Pickup time");
    }
    var flightRow = form.querySelector("[data-flight-row]");
    if (flightRow) flightRow.hidden = trip === "departure";
    if (villaLabel) {
      villaLabel.textContent = trip === "departure"
        ? text("Villa de départ", "Departure villa")
        : text("Villa d’arrivée", "Arrival villa");
    }
    var babyOn = form.querySelector("[name='baby_seat']").checked;
    var seats = form.querySelector("[name='baby_seats']");
    if (babyOn && Number(seats.value) < 1) seats.value = "1";
    var babyCount = babyOn ? Math.max(1, Math.min(3, Number(seats.value) || 1)) : 0;
    seats.value = String(babyCount || 1);
    var babyStep = form.querySelector("[data-baby-step]");
    if (babyStep) babyStep.hidden = !babyOn;
    var babyFigure = form.querySelector("[data-baby-count]");
    if (babyFigure) babyFigure.textContent = String(babyCount || 1);
    var babyDec = form.querySelector('[data-step="baby"][data-dir="-1"]');
    var babyInc = form.querySelector('[data-step="baby"][data-dir="1"]');
    if (babyDec) babyDec.disabled = babyCount <= 1;
    if (babyInc) babyInc.disabled = babyCount >= 3;
    ["passengers", "luggage", "vehicles"].forEach(function (name) {
      var input = form.querySelector("[name='" + name + "']");
      var figure = form.querySelector("[data-" + name + "-count]");
      if (input && figure) figure.textContent = input.value;
    });
    var vehicles = Number(form.querySelector("[name='vehicles']").value) || 1;
    var passengers = Number(form.querySelector("[name='passengers']").value) || 1;
    var prompt = form.querySelector("[data-vehicle-prompt]");
    if (prompt) prompt.hidden = !(vehicles === 1 && passengers >= rates.maxPassengers);
    var price = quote(passengers, babyCount, vehicles);
    renderPrice(form.querySelector("[data-price-box]"), price);
    var split = form.querySelector("[data-vehicle-split]");
    var line = form.querySelector("[data-price-break]");
    if (split && line && price.ready && !price.prompt && price.vehicles === 2) {
      line.hidden = true;
      split.hidden = false;
      var rows = price.loads.map(function (count, index) {
        return text("Véhicule ", "Car ") + (index + 1) + " · " + count + text(" pers. ", " guests ") + money(bandAmount(count));
      });
      if (price.supplements.length) {
        var qty = price.supplements[0].quantity;
        rows.push((qty > 1 ? text(qty + " sièges bébé ", qty + " baby seats ") : text("1 siège bébé ", "1 baby seat ")) + money(price.supplements[0].amount_mad));
      }
      split.innerHTML = rows.join("<br>");
    } else if (split) {
      split.hidden = true;
    }
    var button = form.querySelector("[data-transfer-submit]");
    if (button) button.disabled = !!price.prompt;
  }

  function showSegment(root, name) {
    root.querySelectorAll("[data-show]").forEach(function (button) {
      button.setAttribute("aria-selected", button.getAttribute("data-show") === name ? "true" : "false");
    });
    root.querySelectorAll("[data-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== name;
    });
    var notes = root.querySelector("[data-segment-notes]");
    var duration = root.querySelector('[data-note="duration"]');
    if (notes) notes.hidden = name === "rental";
    if (duration) duration.hidden = name !== "airport";
  }

  function transferRows(data) {
    var arrival = data.fields.trip_type === "arrival";
    var villa = (data.guest && data.guest.villa) || "Villa Zen’O";
    var trip = arrival
      ? text("Aéroport RAK", "RAK Airport") + " → " + villa
      : villa + " → " + text("Aéroport RAK", "RAK Airport");
    var time = data.fields.flight_arrival_time || data.fields.pickup_time;
    var rows = [
      [text("Trajet", "Journey"), trip],
      [text("Date", "Date"), formatDate(data.fields.date)],
      [arrival ? text("Heure d’arrivée du vol", "Arrival time") : text("Heure de prise en charge", "Pickup time"), time]
    ];
    if (data.fields.flight_number) rows.push([text("Vol", "Flight"), data.fields.flight_number]);
    if (data.fields.origin_city) rows.push([text("Ville de provenance", "From"), data.fields.origin_city]);
    rows.push(
      [text("Passagers", "Passengers"), String(data.fields.passengers)],
      [text("Bagages", "Bags"), String(data.fields.luggage)],
      [text("Véhicules", "Vehicles"), String(data.fields.vehicles || 1)],
      [text("Sièges bébé", "Baby seats"), String(data.fields.baby_seats || 0)],
      [text("Total", "Total"), money(data.price.total)]
    );
    return rows;
  }

  function staffTransferRows(data) {
    var arrival = data.fields.trip_type === "arrival";
    var villa = (data.guest && data.guest.villa) || "Villa Zen’O";
    var trip = arrival ? "Aéroport RAK → " + villa : villa + " → Aéroport RAK";
    var time = data.fields.flight_arrival_time || data.fields.pickup_time;
    var rows = [
      ["Trajet", trip],
      ["Date", formatDateFr(data.fields.date)],
      [arrival ? "Heure d’arrivée du vol" : "Heure de prise en charge", time]
    ];
    if (data.fields.flight_number) rows.push(["Vol", data.fields.flight_number]);
    if (data.fields.origin_city) rows.push(["Ville de provenance", data.fields.origin_city]);
    rows.push(
      ["Passagers", String(data.fields.passengers)],
      ["Bagages", String(data.fields.luggage)],
      ["Véhicules", String(data.fields.vehicles || 1)],
      ["Sièges bébé", String(data.fields.baby_seats || 0)],
      ["Total", moneyFr(data.price.total)]
    );
    return rows;
  }

  function renderRows(node, rows) {
    node.innerHTML = rows.map(function (row) {
      return "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>";
    }).join("");
  }

  function showReceived(root, rows) {
    framePage();
    var done = root.querySelector("[data-confirm]");
    renderRows(done.querySelector("[data-confirm-list]"), rows);
    root.querySelectorAll("[data-panel]").forEach(function (panel) { panel.hidden = true; });
    done.hidden = false;
    var segments = root.querySelector(".segments");
    if (segments) segments.hidden = true;
    var pageTitle = root.querySelector("h1");
    if (pageTitle) pageTitle.hidden = true;
    var notes = root.querySelector("[data-segment-notes]");
    if (notes) notes.hidden = true;
    framePage();
  }

  function clock(value) {
    return value ? String(value).slice(0, 5) : "";
  }

  function transferMessage(guest, fields, price) {
    var arrival = fields.trip_type === "arrival";
    var villa = guest.villa || "Villa Zen’O";
    var lines = [
      "Bonjour,",
      "",
      arrival
        ? "Je séjournerai prochainement à la " + villa + " et souhaite réserver un transfert depuis l’aéroport RAK."
        : "Je séjourne actuellement à la " + villa + " et souhaite réserver un transfert vers l’aéroport RAK.",
      "",
      "Nom : " + staffName(guest),
      "Trajet : " + (arrival ? "Aéroport RAK → " + villa : villa + " → Aéroport RAK"),
      "Date : " + formatDateFr(fields.date),
      (arrival ? "Heure d’arrivée du vol : " : "Heure de prise en charge : ") + clock(fields.flight_arrival_time || fields.pickup_time),
      "Passagers : " + fields.passengers,
      "Bagages : " + fields.luggage,
      "Véhicules : " + fields.vehicles
    ];
    if (fields.flight_number) lines.push("Vol : " + fields.flight_number);
    if (fields.origin_city) lines.push("Ville de provenance : " + fields.origin_city);
    lines.push("Sièges bébé : " + (fields.baby_seats ? fields.baby_seats : "Aucun"));
    if (fields.comment) lines.push("Commentaire : " + fields.comment);
    lines.push("Total : " + moneyFr(price.total), "", "Merci d’avance.");
    return lines.join("\n");
  }

  function cityMessage(guest, fields) {
    return [
      "Bonjour,",
      "",
      "Je séjourne actuellement à la " + guest.villa + " et souhaite réserver une course en ville.",
      "",
      "Nom : " + staffName(guest),
      "Nombre de personnes : " + fields.passengers,
      "Date de prise en charge : " + formatDateFr(fields.date),
      "Heure de prise en charge : " + fields.pickup_time,
      "Destination : " + fields.destination,
      "",
      "Pourriez-vous m’indiquer le tarif de cette course ?",
      "",
      "Merci d’avance."
    ].join("\n");
  }

  function cityUrl(guest, fields) {
    return requestWhatsApp(RECIPIENTS.hicham, cityMessage(guest, fields));
  }

  function rentalMessage(guest, fields) {
    var typeLabel = fields.car_type === "4x4" ? "4×4" : "Citadine";
    var delivery = fields.delivery === "airport" ? "À l’aéroport" : "À la villa";
    var usage = fields.usage === "excursion" ? "Excursion" : "À Marrakech";
    var when = fields.pickup_time
      ? "Prise en charge : " + formatDateFr(fields.start_date) + " à " + fields.pickup_time + "\nRestitution : " + formatDateFr(fields.end_date) + " à " + fields.return_time
      : "Début : " + fields.start_date + "\nFin : " + fields.end_date;
    var lines = [
      "Bonjour,",
      "",
      "Je séjourne actuellement à la " + guest.villa + " et souhaite réserver un véhicule auprès de l’agence Massillya.",
      "",
      "Nom : " + staffName(guest),
      when,
      "Véhicule : " + typeLabel,
      "Livraison : " + delivery,
      "Parcours : " + usage
    ];
    if (fields.comment) lines.push("Commentaire : " + fields.comment);
    lines.push("", "Pourriez-vous m’indiquer le tarif et les disponibilités ?", "", "Merci d’avance.");
    return lines.join("\n");
  }

  function rentalUrl(guest, fields) {
    return requestWhatsApp(RECIPIENTS.massillya, rentalMessage(guest, fields));
  }

  function readCity(form) {
    return {
      passengers: Number(form.querySelector("[name='passengers']").value) || 1,
      date: form.querySelector("[name='date']").value,
      pickup_time: form.querySelector("[name='time']").value.slice(0, 5),
      destination: form.querySelector("[name='destination']").value.trim(),
      villa: getGuestFromStay().villa,
      channel: "whatsapp",
      to: "Hicham",
      phone: RECIPIENTS.hicham
    };
  }

  function validateCity(form) {
    clearInvalid(form);
    var date = form.querySelector("[name='date']").value;
    var time = form.querySelector("[name='time']").value;
    var destination = form.querySelector("[name='destination']").value.trim();
    var passengers = Number(form.querySelector("[name='passengers']").value);
    if (!passengers || passengers < 1 || passengers > 8) {
      return text("Veuillez indiquer entre 1 et 8 personnes.", "Please choose between 1 and 8 guests.");
    }
    if (!date || date < todayISO()) {
      setInvalid(form, "date", true);
      return text("Veuillez indiquer une date de prise en charge à venir.", "Please choose a pickup date.");
    }
    if (!time) {
      setInvalid(form, "time", true);
      return text("Veuillez indiquer l’heure de prise en charge.", "Please add the pickup time.");
    }
    if (!destination) {
      setInvalid(form, "destination", true);
      return text("Veuillez indiquer la destination.", "Please add the destination.");
    }
    return "";
  }

  function syncCity(form) {
    var input = form.querySelector("[name='passengers']");
    var count = Math.max(1, Math.min(8, Number(input.value) || 1));
    input.value = String(count);
    var figure = form.querySelector("[data-city-count]");
    if (figure) figure.textContent = String(count);
    var dec = form.querySelector('[data-city-step="-1"]');
    var inc = form.querySelector('[data-city-step="1"]');
    if (dec) dec.disabled = count <= 1;
    if (inc) inc.disabled = count >= 8;
  }

  function inputValue(form, name) {
    var el = form.querySelector("[name='" + name + "']");
    return el ? el.value : "";
  }

  function validateRental(form) {
    clearInvalid(form);
    var start = inputValue(form, "start_date");
    var end = inputValue(form, "end_date");
    var startTime = inputValue(form, "pickup_time");
    var endTime = inputValue(form, "return_time");
    var hasTime = !!form.querySelector("[name='pickup_time']");
    var type = form.querySelector("input[name='car_type']:checked");
    var delivery = form.querySelector("input[name='delivery']:checked");
    var usage = form.querySelector("input[name='usage']:checked");
    if (!start || start < todayISO()) {
      setInvalid(form, "start_date", true);
      return text("Veuillez indiquer une date de prise en charge à venir.", "Please choose a pickup date.");
    }
    if (hasTime && !startTime) {
      setInvalid(form, "pickup_time", true);
      return text("Veuillez indiquer l’heure de prise en charge.", "Please add the pickup time.");
    }
    if (!end || end < start) {
      setInvalid(form, "end_date", true);
      return text("La restitution doit suivre la prise en charge.", "The return must be after pickup.");
    }
    if (hasTime && !endTime) {
      setInvalid(form, "return_time", true);
      return text("Veuillez indiquer l’heure de restitution.", "Please add the return time.");
    }
    if (hasTime && end === start && endTime <= startTime) {
      setInvalid(form, "return_time", true);
      return text("L’heure de restitution doit être postérieure à la prise en charge.", "The return time must be after pickup.");
    }
    if (!type) return text("Veuillez choisir une citadine ou un 4×4.", "Please choose a city car or a 4×4.");
    if (!delivery) return text("Veuillez préciser le lieu de livraison.", "Please choose where we should deliver the car.");
    if (!usage) return text("Veuillez préciser le parcours.", "Please tell us how you plan to use the car.");
    return "";
  }

  function readRental(form) {
    var pickup = clock(inputValue(form, "pickup_time"));
    var back = clock(inputValue(form, "return_time"));
    return {
      start_date: inputValue(form, "start_date"),
      end_date: inputValue(form, "end_date"),
      pickup_time: pickup,
      return_time: back,
      car_type: form.querySelector("input[name='car_type']:checked").value,
      delivery: form.querySelector("input[name='delivery']:checked").value,
      usage: form.querySelector("input[name='usage']:checked").value,
      comment: form.querySelector("[name='comment']").value.trim(),
      agency: "Massillya"
    };
  }

  function openGuestWhatsApp(url) {
    // iOS Safari only allows this during the tap itself. A fetch, even one
    // that is not awaited, ends that permission, so this call stays first.
    var popup = window.open(url, "_blank");
    if (!popup) window.location.href = url;
  }

  function framePage() {
    var active = document.activeElement;
    if (active && active.blur) active.blur();
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }

  function showServiceReceived(root, rows) {
    root.querySelectorAll("[data-service-extra]").forEach(function (node) { node.hidden = true; });
    showReceived(root, rows);
  }

  function bindComment(form) {
    form.addEventListener("click", function (event) {
      if (!event.target.closest("[data-comment-toggle]")) return;
      var box = form.querySelector("[data-comment]");
      if (box) box.hidden = !box.hidden;
    });
  }

  function bindPeople(form, max) {
    function sync() {
      var input = form.querySelector("[name='people']");
      var count = Math.max(1, Math.min(max, Number(input.value) || 1));
      input.value = String(count);
      var figure = form.querySelector("[data-people-count]");
      if (figure) figure.textContent = String(count);
      var dec = form.querySelector('[data-people-step="-1"]');
      var inc = form.querySelector('[data-people-step="1"]');
      if (dec) dec.disabled = count <= 1;
      if (inc) inc.disabled = count >= max;
      return count;
    }
    form.addEventListener("click", function (event) {
      var step = event.target.closest("[data-people-step]");
      if (!step) return;
      var input = form.querySelector("[name='people']");
      input.value = String(Number(input.value) + Number(step.getAttribute("data-people-step")));
      sync();
    });
    sync();
    return sync;
  }

  function noteValue(form) {
    var el = form.querySelector("[name='comment']");
    return el ? el.value.trim() : "";
  }

  function requireWhen(form) {
    var date = form.querySelector("[name='date']").value;
    var time = form.querySelector("[name='time']").value;
    if (!date || date < todayISO()) {
      setInvalid(form, "date", true);
      return "Veuillez indiquer une date à venir.";
    }
    if (!time) {
      setInvalid(form, "time", true);
      return "Veuillez indiquer l’heure.";
    }
    return "";
  }

  function joinFr(parts) {
    if (parts.length < 2) return parts[0] || "";
    if (parts.length === 2) return parts[0] + " et " + parts[1];
    return parts.slice(0, -1).join(", ") + " et " + parts[parts.length - 1];
  }

  function heatingLabel(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    var parts = text.split("/");
    if (parts.length === 2 && parts[0].length === 10 && parts[1].length === 10) {
      return formatDateFr(parts[0]) + " – " + formatDateFr(parts[1]);
    }
    return text;
  }

  function heatingLine(label, item) {
    if (!item || !item.days || !item.rate) return "";
    var days = Number(item.days);
    var rate = Number(item.rate);
    return "Chauffage " + label + " · " + days + " jour" + (days > 1 ? "s" : "") + " × " + rate + "\u00A0€ = " + (days * rate) + "\u00A0€";
  }

  function paintHeating(root) {
    var heating = getGuestFromStay().heating || {};
    var list = root.querySelector("[data-heating-list]");
    var empty = root.querySelector("[data-heating-empty]");
    if (!list) return;
    var lines = [heatingLine("piscine", heating.pool), heatingLine("jacuzzi", heating.jacuzzi)].filter(Boolean);
    if (!lines.length) lines = ["Chauffage piscine · 4 jours × 60 € = 240 €"];
    if (empty) empty.hidden = true;
    list.hidden = false;
    list.innerHTML = lines.map(function (line) { return "<li><span>" + line + "</span></li>"; }).join("");
  }

  function dispatchService(root, record, rows, sousType, destinataire, number, viaVilla) {
    record.token = newToken();
    var message = withStaffConfirm(record.fields.message, record.id, record.token);
    record.fields.message = message;
    submitRequest(record);
    openGuestWhatsApp(viaVilla ? villaWhatsApp(message) : requestWhatsApp(number, message));
    postToSheet(sheetPayload(record, record.token, sousType, destinataire, rows));
    showServiceReceived(root, rows);
  }

  function bindMeals(root) {
    var form = root.querySelector("[data-meal-form]");
    if (!form || !window.MEAL_PRICES) return;
    var prices = window.MEAL_PRICES;
    var error = form.querySelector("[data-errors]");
    var recap = document.querySelector("[data-meal-recap]");
    var names = { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner" };
    var spoken = { breakfast: "le petit-déjeuner", lunch: "le déjeuner", dinner: "le dîner" };
    var windows = { breakfast: [7 * 60, 11 * 60 + 30], lunch: [12 * 60, 15 * 60 + 30], dinner: [19 * 60, 21 * 60] };
    var maxCount = 16;

    function euro(amount) {
      return amount + "\u00A0€";
    }
    function personWord(n) {
      return n + " personne" + (n > 1 ? "s" : "");
    }
    function mealKind() {
      return form.querySelector("[name='meal']").value;
    }
    function clockLabel(value) {
      var parts = value.split(":");
      var hour = String(Number(parts[0]));
      if (parts[1] === "00") return hour + "\u00A0h";
      return hour + "\u00A0h\u00A0" + parts[1];
    }
    function earlyRule() {
      return prices.earlyBreakfast || { supplementEur: 10, before: "09:00" };
    }
    function supplementEuro() {
      if (mealKind() !== "breakfast") return 0;
      var time = form.querySelector("[name='time']").value;
      var rule = earlyRule();
      if (!time || time >= rule.before) return 0;
      return Number(rule.supplementEur) || 0;
    }
    function fillTimes(kind) {
      var select = form.querySelector("[name='time']");
      var previous = select.value;
      var range = windows[kind];
      var rule = earlyRule();
      var html = "<option value=\"\">Choisir</option>";
      for (var t = range[0]; t <= range[1]; t += 30) {
        var h = Math.floor(t / 60);
        var m = t % 60;
        var value = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
        var label = clockLabel(value);
        if (kind === "breakfast" && value < rule.before) label += " · + " + euro(Number(rule.supplementEur) || 0);
        html += "<option value=\"" + value + "\">" + label + "</option>";
      }
      select.innerHTML = html;
      if (select.querySelector("option[value='" + previous + "']")) select.value = previous;
    }
    function paintHours(kind) {
      var el = form.querySelector("[data-meal-hours]");
      if (!el) return;
      var rule = earlyRule();
      if (kind === "breakfast") {
        el.classList.add("meal-hours-split");
        el.innerHTML = "<span>Servi de 9\u00A0h à 12\u00A0h.</span><span>Avant " + clockLabel(rule.before) + ", un supplément de " + euro(Number(rule.supplementEur) || 0) + " vous sera demandé.</span>";
        return;
      }
      el.classList.remove("meal-hours-split");
      el.textContent = kind === "lunch" ? "Servi de 12\u00A0h à 16\u00A0h." : "Servi de 19\u00A0h à 21\u00A0h.";
    }
    function readDish(dish) {
      var input = dish.querySelector("input[type='hidden']");
      var count = Math.max(0, Math.min(maxCount, Number(input.value) || 0));
      input.value = String(count);
      dish.querySelector("[data-dish-count]").textContent = String(count);
      dish.querySelector("[data-dish-step='-1']").disabled = count <= 0;
      dish.querySelector("[data-dish-step='1']").disabled = count >= maxCount;
      return count;
    }
    function readBreakfast() {
      var input = form.querySelector("[name='breakfast']");
      var count = Math.max(0, Math.min(maxCount, Number(input.value) || 0));
      input.value = String(count);
      form.querySelector("[data-breakfast-count]").textContent = String(count);
      form.querySelector("[data-meal-step='breakfast'][data-dir='-1']").disabled = count <= 0;
      form.querySelector("[data-meal-step='breakfast'][data-dir='1']").disabled = count >= maxCount;
      return count;
    }
    function paintPrices() {
      var kind = mealKind();
      var table = kind === "dinner" ? prices.dinner : prices.lunch;
      var unit = form.querySelector("[data-breakfast-price]");
      if (unit) unit.textContent = euro(prices.breakfast) + "\u00A0/\u00A0pers.";
      form.querySelectorAll(".dish").forEach(function (dish) {
        var price = table[dish.getAttribute("data-cat")];
        dish.querySelector("[data-meal-price]").textContent = euro(price);
      });
    }
    function showMeal(kind) {
      form.querySelector("[name='meal']").value = kind;
      form.querySelectorAll("[data-meal]").forEach(function (button) {
        button.setAttribute("aria-selected", button.getAttribute("data-meal") === kind ? "true" : "false");
      });
      form.querySelector("[data-meal-panel='breakfast']").hidden = kind !== "breakfast";
      form.querySelector("[data-meal-panel='menu']").hidden = kind === "breakfast";
      var fouzia = form.querySelector("[data-meal-fouzia]");
      if (fouzia) fouzia.hidden = true;
      fillTimes(kind);
      paintHours(kind);
      paintPrices();
      paintMeal();
    }
    function chosenDishes() {
      var kind = mealKind();
      var table = kind === "dinner" ? prices.dinner : prices.lunch;
      var items = [];
      form.querySelectorAll(".dish").forEach(function (dish) {
        var count = readDish(dish);
        if (!count) return;
        var price = table[dish.getAttribute("data-cat")];
        items.push({ label: dish.getAttribute("data-label"), count: count, price: price, sum: count * price });
      });
      return items;
    }
    function paintMeal() {
      var kind = mealKind();
      var people = 0;
      var total = 0;
      if (kind === "breakfast") {
        people = readBreakfast();
        total = people * prices.breakfast;
      } else {
        chosenDishes().forEach(function (item) {
          people += item.count;
          total += item.sum;
        });
      }
      var extra = supplementEuro();
      if (extra) total += extra;
      var verb = { breakfast: "petit-déjeuner", lunch: "déjeuner", dinner: "dîner" };
      var send = form.querySelector("[data-send-label]");
      if (send) send.textContent = "Réserver mon " + verb[kind] + " · " + euro(total);
      return { people: people, total: total, supplement: extra };
    }
    function tomorrowISO() {
      var d = new Date();
      d.setDate(d.getDate() + 1);
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return d.getFullYear() + "-" + m + "-" + day;
    }
    form.querySelector("[name='date']").min = tomorrowISO();
    form.querySelectorAll(".care-cat").forEach(function (item) {
      item.addEventListener("toggle", function () {
        if (!item.open) return;
        form.querySelectorAll(".care-cat").forEach(function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
    form.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-meal]");
      if (tab) showMeal(tab.getAttribute("data-meal"));
      var salad = event.target.closest("[data-salad]");
      if (salad) {
        var on = salad.getAttribute("aria-pressed") === "true";
        salad.setAttribute("aria-pressed", on ? "false" : "true");
      }
      var step = event.target.closest("[data-meal-step], [data-dish-step]");
      if (step) {
        var dish = step.closest(".dish");
        var input = dish ? dish.querySelector("input[type='hidden']") : form.querySelector("[name='breakfast']");
        input.value = String(Number(input.value) + Number(step.getAttribute("data-dir") || step.getAttribute("data-dish-step")));
        showError(error, "");
      }
      if (tab || salad || step) paintMeal();
    });
    form.querySelector("[name='time']").addEventListener("change", function () { paintMeal(); });
    var typingTimer = 0;
    function typingField(el) {
      if (!el || !el.tagName) return false;
      var tag = el.tagName;
      return tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && el.type !== "hidden");
    }
    document.addEventListener("focusin", function (event) {
      if (!form.contains(event.target) || !typingField(event.target)) return;
      window.clearTimeout(typingTimer);
      document.body.classList.add("is-typing");
    });
    document.addEventListener("focusout", function (event) {
      if (!form.contains(event.target) || !typingField(event.target)) return;
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(function () {
        if (!typingField(document.activeElement)) document.body.classList.remove("is-typing");
      }, 160);
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearInvalid(form);
      var kind = mealKind();
      var quote = paintMeal();
      var date = form.querySelector("[name='date']").value;
      var time = form.querySelector("[name='time']").value;
      if (!date || date < form.querySelector("[name='date']").min) {
        setInvalid(form, "date", true);
        showError(error, "Les repas se commandent pour le lendemain.");
        return;
      }
      if (!time) {
        setInvalid(form, "time", true);
        showError(error, "Veuillez choisir une heure.");
        return;
      }
      var dishes = kind === "breakfast" ? [] : chosenDishes();
      if (kind === "breakfast" && !quote.people) {
        showError(error, "Veuillez indiquer le nombre de personnes.");
        return;
      }
      if (kind !== "breakfast" && !dishes.length) {
        showError(error, "Veuillez choisir au moins un plat.");
        return;
      }
      showError(error, "");
      var guest = getGuestFromStay();
      var salads = Array.prototype.map.call(form.querySelectorAll("[data-salad][aria-pressed='true']"), function (button) {
        return button.getAttribute("data-salad");
      });
      var allergies = form.querySelector("[name='allergies']").value.trim();
      var fields = {
        meal: kind,
        meal_label: names[kind],
        date: date,
        time: time,
        time_label: clockLabel(time),
        salads: salads,
        dishes: dishes,
        people: quote.people,
        allergies: allergies,
        supplement_dh: quote.supplement || 0
      };
      var rows = [
        ["Repas", names[kind]],
        ["Date", formatDate(date)],
        ["Heure", fields.time_label]
      ];
      if (salads.length) rows.push(["Salades", salads.join(", ")]);
      dishes.forEach(function (item) {
        rows.push([item.label, item.count + " · " + euro(item.sum)]);
      });
      if (kind === "breakfast") rows.push(["Personnes", String(quote.people)]);
      if (quote.supplement) rows.push(["Supplément", "Petit-déjeuner avant " + clockLabel(earlyRule().before) + " : " + euro(quote.supplement)]);
      rows.push(["Total", personWord(quote.people) + " · " + euro(quote.total)]);
      if (allergies) rows.push(["Allergies ou demandes", allergies]);
      var lines = [
        "Bonjour,",
        "",
        "Je séjourne actuellement à la " + guest.villa + " et souhaiterais commander " + spoken[kind] + ".",
        "",
        "Nom : " + staffName(guest),
        "Repas : " + names[kind],
        "Date : " + formatDateFr(date),
        "Heure : " + fields.time_label
      ];
      if (salads.length) lines.push("Salades : " + salads.join(", "));
      dishes.forEach(function (item) {
        lines.push(item.label + " : " + item.count + " · " + euro(item.sum));
      });
      if (kind === "breakfast") lines.push("Personnes : " + quote.people);
      if (quote.supplement) lines.push("Supplément petit-déjeuner avant " + clockLabel(earlyRule().before) + " : " + euro(quote.supplement));
      lines.push("Total : " + personWord(quote.people) + " · " + euro(quote.total));
      if (allergies) lines.push("Allergies ou demandes : " + allergies);
      lines.push("", "Merci d’avance.");
      fields.message = lines.join("\n");
      dispatchService(root, baseRecord("restauration", guest, fields, { price_base: quote.total, supplements: [], total: quote.total, blocked: false }), rows, kind, "Cuisine", "", true);
    });
    showMeal("lunch");
  }

  function initServices(root) {
    paintHeating(root);
    bindMeals(root);
    var menage = root.querySelector("[data-menage-form]");
    if (menage) {
      var menageError = menage.querySelector("[data-errors]");
      bindComment(menage);
      menage.addEventListener("submit", function (event) {
        event.preventDefault();
        clearInvalid(menage);
        var scope = menage.querySelector("input[name='scope']:checked");
        var when = requireWhen(menage);
        if (!scope) {
          showError(menageError, "Veuillez choisir le périmètre.");
          return;
        }
        showError(menageError, when);
        if (when) return;
        var guest = getGuestFromStay();
        var label = scope.getAttribute("data-label");
        var fields = {
          scope: scope.value,
          scope_label: label,
          date: menage.querySelector("[name='date']").value,
          time: clock(menage.querySelector("[name='time']").value),
          comment: noteValue(menage)
        };
        var rows = [
          ["Périmètre", label],
          ["Date", formatDate(fields.date)],
          ["Heure", fields.time]
        ];
        if (fields.comment) rows.push(["Note", fields.comment]);
        var lines = [
          "Bonjour,",
          "",
          "Je séjourne actuellement à la " + guest.villa + " et souhaiterais un service de ménage.",
          "",
          "Nom : " + staffName(guest),
          "Périmètre : " + label,
          "Date : " + formatDateFr(fields.date),
          "Heure : " + fields.time
        ];
        if (fields.comment) lines.push("Note : " + fields.comment);
        lines.push("", "Merci d’avance.");
        fields.message = lines.join("\n");
        dispatchService(root, baseRecord("menage", guest, fields, null), rows, scope.value === "chambres" ? "chambres" : "maison", "Ménage", "", true);
      });
    }

    var pool = root.querySelector("[data-pool-form]");
    if (pool) {
      var poolError = pool.querySelector("[data-errors]");
      var phrases = { piscine: "de la piscine", jacuzzi: "du jacuzzi", jardin: "du jardin" };
      bindComment(pool);
      pool.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-clean]");
        if (!chip) return;
        chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
      });
      pool.addEventListener("submit", function (event) {
        event.preventDefault();
        clearInvalid(pool);
        var chosen = Array.prototype.slice.call(pool.querySelectorAll("[data-clean][aria-pressed='true']"));
        if (!chosen.length) {
          showError(poolError, "Veuillez choisir au moins un espace.");
          return;
        }
        var when = requireWhen(pool);
        showError(poolError, when);
        if (when) return;
        var guest = getGuestFromStay();
        var labels = chosen.map(function (chip) { return chip.getAttribute("data-label"); });
        var spoken = chosen.map(function (chip) { return phrases[chip.getAttribute("data-clean")]; });
        var fields = {
          areas: chosen.map(function (chip) { return chip.getAttribute("data-clean"); }),
          areas_label: labels.join(", "),
          date: pool.querySelector("[name='date']").value,
          time: clock(pool.querySelector("[name='time']").value),
          comment: noteValue(pool)
        };
        var rows = [
          ["Entretien", labels.join(", ")],
          ["Date", formatDate(fields.date)],
          ["Heure", fields.time]
        ];
        if (fields.comment) rows.push(["Note", fields.comment]);
        var lines = [
          "Bonjour,",
          "",
          "Je séjourne actuellement à la " + guest.villa + " et souhaiterais un entretien " + joinFr(spoken) + ".",
          "",
          "Nom : " + staffName(guest),
          "Entretien : " + labels.join(", "),
          "Date : " + formatDateFr(fields.date),
          "Heure : " + fields.time
        ];
        if (fields.comment) lines.push("Note : " + fields.comment);
        lines.push("", "Merci d’avance.");
        fields.message = lines.join("\n");
        dispatchService(root, baseRecord("piscine", guest, fields, null), rows, "nettoyage", "Piscine", "", true);
      });
    }

    var activity = root.querySelector("[data-activity-form]");
    if (activity) {
      var activityError = activity.querySelector("[data-errors]");
      var mixNoun = { quad: ["quad", "quads"], dromadaire: ["dromadaire", "dromadaires"] };
      bindComment(activity);
      function readCount(name, min, max) {
        var input = activity.querySelector("[name='" + name + "']");
        var count = Math.max(min, Math.min(max, Number(input.value) || min));
        input.value = String(count);
        var figure = activity.querySelector("[data-" + name + "-count]");
        if (figure) figure.textContent = String(count);
        var dec = activity.querySelector('[data-count="' + name + '"][data-dir="-1"]');
        var inc = activity.querySelector('[data-count="' + name + '"][data-dir="1"]');
        if (dec) dec.disabled = count <= min;
        if (inc) inc.disabled = count >= max;
        return count;
      }
      function mixQuote(kind) {
        var lines = [];
        var vehicles = 0;
        var people = 0;
        var total = 0;
        activity.querySelectorAll('[data-mix="' + kind + '"] input[type="hidden"]').forEach(function (input) {
          var count = readCount(input.name, 0, 8);
          var price = Number(input.getAttribute("data-price"));
          var seats = Number(input.getAttribute("data-seats"));
          vehicles += count;
          people += count * seats;
          total += count * price;
          lines.push({
            count: count,
            price: price,
            seats: seats,
            wa: input.getAttribute("data-wa"),
            sum: count * price
          });
        });
        return { lines: lines, vehicles: vehicles, people: people, total: total };
      }
      function paintActivity() {
        var chosen = activity.querySelector("input[name='activity']:checked");
        var kind = chosen ? chosen.value : "";
        activity.querySelectorAll("[data-mix]").forEach(function (block) {
          block.hidden = block.getAttribute("data-mix") !== kind;
        });
        var horse = activity.querySelector("[data-horse-people]");
        if (horse) horse.hidden = kind !== "cheval";
        ["quad1", "quad2", "drom1", "drom2"].forEach(function (name) { readCount(name, 0, 8); });
        var riders = readCount("riders", 1, 6);
        var box = activity.querySelector("[data-price-box]");
        var priced = kind === "quad" || kind === "dromadaire";
        if (!box || !priced) {
          if (box) box.hidden = true;
          if (kind === "cheval") showError(activityError, "");
          return { total: null, riders: riders, lines: [] };
        }
        var quote = mixQuote(kind);
        var used = quote.lines.filter(function (line) { return line.count > 0; });
        box.hidden = !used.length;
        if (used.length) {
          box.querySelector("[data-price-total]").textContent = "Total " + moneyFr(quote.total);
          var line = box.querySelector("[data-price-break]");
          line.hidden = false;
          line.textContent = used.map(function (item) { return item.count + " × " + item.price; }).join(" + ");
        }
        quote.riders = riders;
        if (quote.vehicles) showError(activityError, "");
        return quote;
      }
      activity.addEventListener("click", function (event) {
        var step = event.target.closest("[data-count]");
        if (step) {
          var name = step.getAttribute("data-count");
          var input = activity.querySelector("[name='" + name + "']");
          input.value = String(Number(input.value) + Number(step.getAttribute("data-dir")));
        }
        if (step || event.target.closest("input[name='activity']") || event.target.closest(".pick")) paintActivity();
      });
      activity.addEventListener("change", paintActivity);
      paintActivity();
      activity.addEventListener("submit", function (event) {
        event.preventDefault();
        clearInvalid(activity);
        var chosen = activity.querySelector("input[name='activity']:checked");
        if (!chosen) {
          showError(activityError, "Veuillez choisir une activité.");
          return;
        }
        var quote = paintActivity();
        var priced = chosen.value === "quad" || chosen.value === "dromadaire";
        if (priced && !quote.vehicles) {
          showError(activityError, chosen.value === "quad" ? "Veuillez indiquer au moins un quad." : "Veuillez indiquer au moins un dromadaire.");
          return;
        }
        var when = requireWhen(activity);
        showError(activityError, when);
        if (when) return;
        var guest = getGuestFromStay();
        var fields = {
          activity: chosen.value,
          activity_label: chosen.getAttribute("data-label"),
          duration: chosen.getAttribute("data-duration") || "",
          lines: priced ? quote.lines : [],
          vehicles: priced ? quote.vehicles : "",
          people: priced ? quote.people : "",
          riders: priced ? "" : quote.riders,
          date: activity.querySelector("[name='date']").value,
          time: clock(activity.querySelector("[name='time']").value),
          pickup: guest.villa,
          comment: noteValue(activity)
        };
        var rows = [["Activité", fields.activity_label]];
        if (fields.duration) rows.push(["Durée", fields.duration]);
        if (priced) {
          quote.lines.forEach(function (item) {
            if (item.count) rows.push([item.wa, item.count + " · " + moneyFr(item.sum)]);
          });
          var noun = mixNoun[chosen.value];
          rows.push(["Total " + noun[1], quote.vehicles + " " + (quote.vehicles > 1 ? noun[1] : noun[0]) + ", " + quote.people + " " + (quote.people > 1 ? "personnes" : "personne")]);
        } else {
          rows.push(["Personnes", String(quote.riders)]);
        }
        rows.push(["Date", formatDate(fields.date)], ["Heure", fields.time], ["Départ", guest.villa]);
        if (quote.total != null && quote.vehicles) rows.push(["Total", moneyFr(quote.total)]);
        if (fields.comment) rows.push(["Note", fields.comment]);
        var lines = [
          "Bonjour,",
          "",
          "Je séjourne actuellement à la " + guest.villa + " et souhaiterais réserver " + chosen.getAttribute("data-sentence") + ".",
          "",
          "Nom : " + staffName(guest),
          "Activité : " + fields.activity_label
        ];
        if (fields.duration) lines.push("Durée : " + fields.duration);
        if (priced) {
          quote.lines.forEach(function (item) {
            if (item.count) lines.push(item.wa + " : " + item.count + " · " + moneyFr(item.sum));
          });
          var word = mixNoun[chosen.value];
          lines.push("Total " + word[1] + " : " + quote.vehicles + " " + (quote.vehicles > 1 ? word[1] : word[0]) + ", " + quote.people + " " + (quote.people > 1 ? "personnes" : "personne"));
          lines.push("Total : " + moneyFr(quote.total));
        } else {
          lines.push("Personnes : " + quote.riders);
        }
        lines.push(
          "Date : " + formatDateFr(fields.date),
          "Heure : " + fields.time,
          "Départ : " + guest.villa
        );
        if (fields.comment) lines.push("Note : " + fields.comment);
        if (!priced) lines.push("", "Pourriez-vous m’indiquer le tarif ?");
        lines.push("", "Merci d’avance.");
        fields.message = lines.join("\n");
        var price = !priced || !quote.vehicles ? null : { price_base: quote.total, supplements: [], total: quote.total, blocked: false };
        var quad = chosen.value === "quad";
        dispatchService(root, baseRecord("activites", guest, fields, price), rows, chosen.value, "Activités", quad ? "" : RECIPIENTS.activites, quad);
      });
    }

    var massage = root.querySelector("[data-massage-form]");
    if (massage) {
      var massageError = massage.querySelector("[data-errors]");
      bindComment(massage);
      massage.querySelectorAll(".care-cat").forEach(function (item) {
        item.addEventListener("toggle", function () {
          if (!item.open) return;
          massage.querySelectorAll(".care-cat").forEach(function (other) {
            if (other !== item) other.open = false;
          });
        });
      });
      function soinItems() {
        return Array.prototype.slice.call(massage.querySelectorAll(".soin"));
      }
      function soinChosen(item) {
        return item.querySelector(".soin-pick").getAttribute("aria-pressed") === "true";
      }
      function soinDetail(item) {
        return {
          id: item.getAttribute("data-soin"),
          category: item.closest(".care-cat").getAttribute("data-category"),
          label: item.getAttribute("data-label"),
          minutes: item.getAttribute("data-minutes") || "",
          people: Number(item.querySelector("input[type='hidden']").value),
          price: Number(item.getAttribute("data-price"))
        };
      }
      function soinLine(item) {
        var name = item.minutes ? item.label + " · " + item.minutes : item.label;
        return name + " × " + item.people + " · " + moneyFr(item.price * item.people);
      }
      function paintMassage() {
        var total = 0;
        var any = false;
        soinItems().forEach(function (item) {
          var input = item.querySelector("input[type='hidden']");
          var count = Math.max(1, Math.min(8, Number(input.value) || 1));
          input.value = String(count);
          item.querySelector("[data-soin-count]").textContent = String(count);
          var dec = item.querySelector('[data-soin-step="-1"]');
          var inc = item.querySelector('[data-soin-step="1"]');
          if (dec) dec.disabled = count <= 1;
          if (inc) inc.disabled = count >= 8;
          if (soinChosen(item)) {
            any = true;
            total += Number(item.getAttribute("data-price")) * count;
          }
        });
        massage.querySelectorAll(".care-cat").forEach(function (cat) {
          var n = cat.querySelectorAll(".soin-pick[aria-pressed='true']").length;
          var badge = cat.querySelector("[data-care-count]");
          var live = cat.querySelector("[data-care-live]");
          if (badge) {
            badge.hidden = n === 0;
            badge.textContent = String(n);
          }
          if (live) live.textContent = n ? (n > 1 ? n + " soins sélectionnés" : "1 soin sélectionné") : "";
        });
        var box = massage.querySelector("[data-price-box]");
        if (box) {
          box.hidden = !any;
          if (any) {
            box.querySelector("[data-price-total]").textContent = "Total " + moneyFr(total);
            box.querySelector("[data-price-break]").hidden = true;
          }
        }
        return any ? total : null;
      }
      massage.addEventListener("click", function (event) {
        var pick = event.target.closest(".soin-pick");
        if (pick) {
          var on = pick.getAttribute("aria-pressed") === "true";
          pick.setAttribute("aria-pressed", on ? "false" : "true");
        }
        var step = event.target.closest("[data-soin-step]");
        if (step) {
          var item = step.closest(".soin");
          var input = item.querySelector("input[type='hidden']");
          input.value = String(Number(input.value) + Number(step.getAttribute("data-soin-step")));
        }
        if (pick || step) paintMassage();
      });
      paintMassage();
      massage.addEventListener("submit", function (event) {
        event.preventDefault();
        clearInvalid(massage);
        var groups = [];
        massage.querySelectorAll(".care-cat").forEach(function (cat) {
          var items = Array.prototype.filter.call(cat.querySelectorAll(".soin"), soinChosen).map(soinDetail);
          if (items.length) groups.push({ name: cat.getAttribute("data-category"), items: items });
        });
        var details = groups.reduce(function (all, group) { return all.concat(group.items); }, []);
        if (!details.length) {
          showError(massageError, "Veuillez choisir au moins un soin.");
          return;
        }
        var when = requireWhen(massage);
        showError(massageError, when);
        if (when) return;
        var guest = getGuestFromStay();
        var total = paintMassage();
        var fields = {
          soins: details,
          date: massage.querySelector("[name='date']").value,
          time: clock(massage.querySelector("[name='time']").value),
          comment: noteValue(massage)
        };
        var rows = [];
        groups.forEach(function (group) {
          group.items.forEach(function (item) {
            var meta = item.minutes ? item.minutes + " · " : "";
            rows.push([item.label, meta + item.people + " pers. · " + moneyFr(item.price * item.people)]);
          });
        });
        rows.push(["Date", formatDate(fields.date)], ["Heure", fields.time], ["Total", moneyFr(total)]);
        if (fields.comment) rows.push(["Note", fields.comment]);
        var lines = [
          "Bonjour,",
          "",
          "Je séjourne actuellement à la " + guest.villa + " et souhaiterais réserver " + (details.length > 1 ? "les soins suivants." : "le soin suivant."),
          "",
          "Nom : " + staffName(guest),
          ""
        ];
        groups.forEach(function (group, index) {
          if (index) lines.push("");
          lines.push(group.name);
          group.items.forEach(function (item) { lines.push(soinLine(item)); });
        });
        lines.push(
          "",
          "Date : " + formatDateFr(fields.date),
          "Heure : " + fields.time
        );
        if (fields.comment) lines.push("Note : " + fields.comment);
        lines.push("Total : " + moneyFr(total), "", "Merci d’avance.");
        fields.message = lines.join("\n");
        dispatchService(root, baseRecord("massage", guest, fields, { price_base: total, supplements: [], total: total, blocked: false }), rows, details.map(function (item) { return item.id; }).join("+"), "Massages & soins", RECIPIENTS.massage);
      });
    }
  }

  function init() {
    var root = document.querySelector("[data-request-page]");
    if (!root) return;
    var transfer = root.querySelector("[data-transfer-form]");
    var rental = root.querySelector("[data-rental-form]");
    var today = todayISO();
    root.querySelectorAll("input[type='date'], input[type='time']").forEach(function (input) {
      if (input.type === "date") input.min = today;
      paintPicker(input);
      input.addEventListener("input", function () { paintPicker(input); });
      input.addEventListener("change", function () { paintPicker(input); });
    });
    root.querySelectorAll("[data-show]").forEach(function (button) {
      button.addEventListener("click", function () {
        showSegment(root, button.getAttribute("data-show"));
      });
    });
    if (root.querySelector("[data-show]")) showSegment(root, location.hash === "#ville" ? "city" : "airport");

    if (transfer) {
      var errorNode = transfer.querySelector("[data-errors]");
      syncTransfer(transfer);
      transfer.addEventListener("click", function (event) {
        var step = event.target.closest("[data-step]");
        if (step) {
          var name = step.getAttribute("data-step");
          var input = transfer.querySelector("[name='" + name + "']");
          var dir = Number(step.getAttribute("data-dir"));
          var vehicles = Number(transfer.querySelector("[name='vehicles']").value) || 1;
          var next = Number(input.value) + dir;
          if (name === "passengers") {
            var max = rates.maxPassengers * vehicles;
            if (vehicles === 1 && Number(input.value) >= rates.maxPassengers && dir > 0) {
              var note = transfer.querySelector("[data-vehicle-prompt]");
              if (note) note.hidden = false;
              return;
            }
            next = Math.max(1, Math.min(max, next));
          } else if (name === "vehicles") {
            next = Math.max(1, Math.min(2, next));
            var pax = transfer.querySelector("[name='passengers']");
            if (next === 1 && Number(pax.value) > rates.maxPassengers) pax.value = String(rates.maxPassengers);
          } else if (name === "luggage") {
            next = Math.max(0, Math.min(16, next));
          } else if (name === "baby") {
            next = Math.max(1, Math.min(3, Number(transfer.querySelector("[name='baby_seats']").value) + dir));
            transfer.querySelector("[name='baby_seats']").value = String(next);
            syncTransfer(transfer);
            return;
          }
          input.value = String(next);
          syncTransfer(transfer);
          return;
        }
        if (event.target.closest("[data-comment-toggle]")) {
          var box = transfer.querySelector("[data-comment]");
          box.hidden = !box.hidden;
        }
      });
      transfer.addEventListener("change", function () { syncTransfer(transfer); });
      transfer.addEventListener("input", function () { syncTransfer(transfer); });
      transfer.addEventListener("submit", function (event) {
        event.preventDefault();
        var message = validateTransfer(transfer);
        showError(errorNode, message);
        if (message) return;
        var data = readTransfer(transfer);
        var rows = transferRows(data);
        var record = baseRecord("transfert", data.guest, data.fields, data.price);
        record.token = newToken();
        data.fields.message = withStaffConfirm(transferMessage(data.guest, data.fields, data.price), record.id, record.token);
        submitRequest(record);
        openGuestWhatsApp(requestWhatsApp(RECIPIENTS.hicham, data.fields.message));
        postToSheet(sheetPayload(record, record.token, data.fields.trip_type === "departure" ? "départ" : "arrivée", "Hicham", staffTransferRows(data)));
        showReceived(root, rows);
      });
    }

    var city = root.querySelector("[data-city-form]");
    if (city) {
      var cityError = city.querySelector("[data-errors]");
      syncCity(city);
      city.addEventListener("click", function (event) {
        var step = event.target.closest("[data-city-step]");
        if (!step) return;
        var input = city.querySelector("[name='passengers']");
        input.value = String(Number(input.value) + Number(step.getAttribute("data-city-step")));
        syncCity(city);
      });
      city.addEventListener("submit", function (event) {
        event.preventDefault();
        var message = validateCity(city);
        showError(cityError, message);
        if (message) return;
        var guest = getGuestFromStay();
        var fields = readCity(city);
        var rows = [
          [text("Personnes", "Guests"), String(fields.passengers)],
          [text("Date", "Date"), formatDate(fields.date)],
          [text("Heure de prise en charge", "Pickup time"), fields.pickup_time],
          [text("Destination", "Destination"), fields.destination]
        ];
        var staffRows = [
          ["Personnes", String(fields.passengers)],
          ["Date", formatDateFr(fields.date)],
          ["Heure de prise en charge", fields.pickup_time],
          ["Destination", fields.destination]
        ];
        var record = baseRecord("course", guest, fields, null);
        record.token = newToken();
        fields.message = withStaffConfirm(cityMessage(guest, fields), record.id, record.token);
        submitRequest(record);
        openGuestWhatsApp(requestWhatsApp(RECIPIENTS.hicham, fields.message));
        postToSheet(sheetPayload(record, record.token, "en ville", "Hicham", staffRows));
        showReceived(root, rows);
      });
    }

    if (rental) {
      var rentalError = rental.querySelector("[data-errors]");
      rental.addEventListener("click", function (event) {
        if (!event.target.closest("[data-comment-toggle]")) return;
        var box = rental.querySelector("[data-comment]");
        box.hidden = !box.hidden;
      });
      rental.addEventListener("submit", function (event) {
        event.preventDefault();
        var message = validateRental(rental);
        showError(rentalError, message);
        if (message) return;
        var guest = getGuestFromStay();
        var fields = readRental(rental);
        var rentalRows = [
          [text("Prise en charge", "Pickup"), formatDate(fields.start_date) + " · " + fields.pickup_time],
          [text("Restitution", "Return"), formatDate(fields.end_date) + " · " + fields.return_time],
          [text("Véhicule", "Vehicle"), fields.car_type === "4x4" ? "4×4" : text("Citadine", "City car")],
          [text("Livraison", "Delivery"), fields.delivery === "airport" ? text("À l’aéroport", "RAK Airport") : text("À la villa", "The villa")],
          [text("Parcours", "Plans"), fields.usage === "excursion" ? text("Excursion", "A day trip") : text("À Marrakech", "In Marrakech")]
        ];
        if (fields.comment) rentalRows.push([text("Commentaire", "Note"), fields.comment]);
        var staffRentalRows = [
          ["Prise en charge", formatDateFr(fields.start_date) + " · " + fields.pickup_time],
          ["Restitution", formatDateFr(fields.end_date) + " · " + fields.return_time],
          ["Véhicule", fields.car_type === "4x4" ? "4×4" : "Citadine"],
          ["Livraison", fields.delivery === "airport" ? "À l’aéroport" : "À la villa"],
          ["Parcours", fields.usage === "excursion" ? "Excursion" : "À Marrakech"]
        ];
        if (fields.comment) staffRentalRows.push(["Commentaire", fields.comment]);
        var record = baseRecord("location_voiture", guest, fields, null);
        record.token = newToken();
        fields.message = withStaffConfirm(rentalMessage(guest, fields), record.id, record.token);
        submitRequest(record);
        openGuestWhatsApp(requestWhatsApp(RECIPIENTS.massillya, fields.message));
        postToSheet(sheetPayload(record, record.token, fields.car_type === "4x4" ? "4x4" : "citadine", "Massillya", staffRentalRows));
        showReceived(root, rentalRows);
      });
    }
    initServices(root);
  }

  window.GuestRequests = {
    config: config,
    getGuestFromStay: getGuestFromStay,
    quote: quote,
    breakdown: breakdown,
    formatDate: formatDate,
    submitRequest: submitRequest,
    TEST_MODE: TEST_MODE,
    TEST_WHATSAPP: TEST_WHATSAPP,
    RECIPIENTS: RECIPIENTS,
    cityUrl: cityUrl,
    rentalUrl: rentalUrl,
    stayId: stayId,
    listDemandes: listDemandes
  };

  function listDemandes(stay) {
    if (!APPS_SCRIPT_URL || !stay || !window.fetch) return Promise.resolve([]);
    var url = APPS_SCRIPT_URL + "?action=list&stay=" + encodeURIComponent(stay);
    return window.fetch(url).then(function (response) {
      return response.json();
    }).then(function (data) {
      if (Array.isArray(data)) return { items: data, stay: null };
      return { items: (data && data.items) || [], stay: (data && data.stay) || null };
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
