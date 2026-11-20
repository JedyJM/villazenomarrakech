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

  /* Test routing for request WhatsApp buttons only.
     Flip TEST_MODE to false to open the real recipients again.
     TEST_WHATSAPP is Mehdi, the owner number in Contacts utiles. */
  var TEST_MODE = true;
  var TEST_WHATSAPP = "212661147610";
  var RECIPIENTS = {
    hicham: "212661775422",
    massillya: "212616172974",
    menage: "212661147610",
    piscine: "212661147610",
    activites: "212661147610",
    massage: "212661147610"
  };

  function requestWhatsApp(realNumber, message) {
    var number = TEST_MODE ? TEST_WHATSAPP : realNumber;
    return "https://api.whatsapp.com/send?phone=" + number + "&text=" + encodeURIComponent(message);
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
    return message + "\n\n✅ Merci de confirmer ici :\n" + confirmLink(id, token);
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

  function getGuestFromStay() {
    // Placeholder. Name and phone will be looked up from the Google Sheet
    // "Villa Zen'O – Bookings", tab Réservations, using the stay booking id.
    // The guest does not type them.
    return {
      name: isEn() ? "Guest" : "Invité",
      phone: "+212 600 000 000",
      villa: "Villa Zen’O",
      example: true,
      // Read only. Tab Réservations, never written by the portal.
      // chauffage_piscine and chauffage_jacuzzi: empty, or YYYY-MM-DD/YYYY-MM-DD.
      heating: { pool: "", jacuzzi: "" }
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
    return amount + (isEn() ? " MAD" : " DH");
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

  function paintHeating(root) {
    var heating = getGuestFromStay().heating || {};
    var pool = heatingLabel(heating.pool);
    var jacuzzi = heatingLabel(heating.jacuzzi);
    var empty = root.querySelector("[data-heating-empty]");
    var list = root.querySelector("[data-heating-list]");
    if (!empty || !list) return;
    if (!pool && !jacuzzi) {
      empty.hidden = false;
      list.hidden = true;
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    var items = [];
    if (pool) items.push("<li><span>Piscine</span><span>" + pool + "</span></li>");
    if (jacuzzi) items.push("<li><span>Jacuzzi</span><span>" + jacuzzi + "</span></li>");
    list.innerHTML = items.join("");
  }

  function dispatchService(root, record, rows, sousType, destinataire, number) {
    record.token = newToken();
    var message = withStaffConfirm(record.fields.message, record.id, record.token);
    record.fields.message = message;
    submitRequest(record);
    openGuestWhatsApp(requestWhatsApp(number, message));
    postToSheet(sheetPayload(record, record.token, sousType, destinataire, rows));
    showServiceReceived(root, rows);
  }

  function initServices(root) {
    paintHeating(root);
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
        dispatchService(root, baseRecord("menage", guest, fields, null), rows, scope.value === "chambres" ? "chambres" : "maison", "Ménage", RECIPIENTS.menage);
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
        dispatchService(root, baseRecord("piscine", guest, fields, null), rows, "nettoyage", "Piscine", RECIPIENTS.piscine);
      });
    }

    var activity = root.querySelector("[data-activity-form]");
    if (activity) {
      var activityError = activity.querySelector("[data-errors]");
      bindComment(activity);
      var syncActivityPeople = bindPeople(activity, 4);
      function paintActivity() {
        var box = activity.querySelector("[data-price-box]");
        var chosen = activity.querySelector("input[name='activity']:checked");
        var people = syncActivityPeople();
        if (!box || !chosen || chosen.getAttribute("data-base") === "") {
          if (box) box.hidden = true;
          return null;
        }
        var base = Number(chosen.getAttribute("data-base"));
        var extra = Number(chosen.getAttribute("data-extra")) || 0;
        var total = base + extra * Math.max(0, people - 1);
        box.hidden = false;
        box.querySelector("[data-price-total]").textContent = "Total " + moneyFr(total);
        var line = box.querySelector("[data-price-break]");
        if (people > 1 && extra) {
          line.hidden = false;
          line.textContent = moneyFr(base) + " + " + moneyFr(extra * (people - 1));
        } else {
          line.hidden = true;
        }
        return total;
      }
      activity.addEventListener("change", paintActivity);
      activity.addEventListener("click", function (event) {
        if (event.target.closest("[data-people-step]") || event.target.closest("input[name='activity']")) paintActivity();
      });
      activity.addEventListener("submit", function (event) {
        event.preventDefault();
        clearInvalid(activity);
        var chosen = activity.querySelector("input[name='activity']:checked");
        if (!chosen) {
          showError(activityError, "Veuillez choisir une activité.");
          return;
        }
        var when = requireWhen(activity);
        showError(activityError, when);
        if (when) return;
        var guest = getGuestFromStay();
        var people = syncActivityPeople();
        var total = paintActivity();
        var fields = {
          activity: chosen.value,
          activity_label: chosen.getAttribute("data-label"),
          duration: chosen.getAttribute("data-duration") || "",
          people: people,
          date: activity.querySelector("[name='date']").value,
          time: clock(activity.querySelector("[name='time']").value),
          pickup: guest.villa,
          comment: noteValue(activity)
        };
        var rows = [
          ["Activité", fields.activity_label],
          ["Personnes", String(people)],
          ["Date", formatDate(fields.date)],
          ["Heure", fields.time],
          ["Départ", guest.villa]
        ];
        if (fields.duration) rows.splice(1, 0, ["Durée", fields.duration]);
        if (total != null) rows.push(["Total", moneyFr(total)]);
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
        lines.push(
          "Personnes : " + people,
          "Date : " + formatDateFr(fields.date),
          "Heure : " + fields.time,
          "Départ : " + guest.villa
        );
        if (fields.comment) lines.push("Note : " + fields.comment);
        if (total != null) lines.push("Total : " + moneyFr(total));
        if (total == null) lines.push("", "Pourriez-vous m’indiquer le tarif ?");
        lines.push("", "Merci d’avance.");
        fields.message = lines.join("\n");
        var price = total == null ? null : { price_base: total, supplements: [], total: total, blocked: false };
        dispatchService(root, baseRecord("activites", guest, fields, price), rows, chosen.value, "Activités", RECIPIENTS.activites);
      });
    }

    var massage = root.querySelector("[data-massage-form]");
    if (massage) {
      var massageError = massage.querySelector("[data-errors]");
      bindComment(massage);
      var syncMassagePeople = bindPeople(massage, 8);
      function selectedSoin() {
        var select = massage.querySelector("[name='treatment']");
        return select.options[select.selectedIndex];
      }
      function paintMassage() {
        var opt = selectedSoin();
        var detail = massage.querySelector("[data-soin-detail]");
        var box = massage.querySelector("[data-price-box]");
        var people = syncMassagePeople();
        var priced = opt && opt.value && opt.getAttribute("data-price");
        var minutes = opt ? (opt.getAttribute("data-minutes") || "") : "";
        var complement = opt && opt.getAttribute("data-complement") === "1";
        if (detail) {
          var bit = complement ? "En complément d’un autre soin" : minutes;
          detail.hidden = !bit;
          detail.textContent = bit;
        }
        if (!priced) {
          if (box) box.hidden = true;
          return null;
        }
        var unit = Number(opt.getAttribute("data-price"));
        var total = unit * people;
        box.hidden = false;
        box.querySelector("[data-price-total]").textContent = "Total " + moneyFr(total);
        var line = box.querySelector("[data-price-break]");
        if (people > 1) {
          line.hidden = false;
          line.textContent = people + " × " + moneyFr(unit);
        } else {
          line.hidden = true;
        }
        return total;
      }
      massage.addEventListener("change", paintMassage);
      massage.addEventListener("click", function (event) {
        if (event.target.closest("[data-people-step]")) paintMassage();
      });
      massage.addEventListener("submit", function (event) {
        event.preventDefault();
        clearInvalid(massage);
        var opt = selectedSoin();
        if (!opt || !opt.value) {
          showError(massageError, "Veuillez choisir un soin.");
          return;
        }
        var when = requireWhen(massage);
        showError(massageError, when);
        if (when) return;
        var guest = getGuestFromStay();
        var people = syncMassagePeople();
        var total = paintMassage();
        var label = opt.getAttribute("data-label");
        var minutes = opt.getAttribute("data-minutes") || "";
        var fields = {
          treatment: opt.value,
          treatment_label: label,
          duration: minutes,
          people: people,
          date: massage.querySelector("[name='date']").value,
          time: clock(massage.querySelector("[name='time']").value),
          comment: noteValue(massage)
        };
        var rows = [
          ["Soin", label],
          ["Personnes", String(people)],
          ["Date", formatDate(fields.date)],
          ["Heure", fields.time]
        ];
        if (minutes) rows.splice(1, 0, ["Durée", minutes]);
        if (total != null) rows.push(["Total", moneyFr(total)]);
        if (fields.comment) rows.push(["Note", fields.comment]);
        var wish = label.indexOf("Massage") === 0 ? "un massage" : (label === "Brushing" ? "un brushing" : "un soin");
        var lines = [
          "Bonjour,",
          "",
          "Je séjourne actuellement à la " + guest.villa + " et souhaiterais réserver " + wish + ".",
          "",
          "Nom : " + staffName(guest),
          "Soin : " + label
        ];
        if (minutes) lines.push("Durée : " + minutes);
        lines.push(
          "Personnes : " + people,
          "Date : " + formatDateFr(fields.date),
          "Heure : " + fields.time
        );
        if (fields.comment) lines.push("Note : " + fields.comment);
        if (total != null) lines.push("Total : " + moneyFr(total));
        if (total == null) lines.push("", "Pourriez-vous m’indiquer le tarif ?");
        lines.push("", "Merci d’avance.");
        fields.message = lines.join("\n");
        var price = total == null ? null : { price_base: total, supplements: [], total: total, blocked: false };
        dispatchService(root, baseRecord("massage", guest, fields, price), rows, opt.value, "Massage", RECIPIENTS.massage);
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
    rentalUrl: rentalUrl
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
