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
    massillya: "212616172974"
  };

  function requestWhatsApp(realNumber, message) {
    var number = TEST_MODE ? TEST_WHATSAPP : realNumber;
    return "https://api.whatsapp.com/send?phone=" + number + "&text=" + encodeURIComponent(message);
  }

  function newToken() {
    var bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var hex = "";
    for (var j = 0; j < bytes.length; j++) hex += ("0" + bytes[j].toString(16)).slice(-2);
    return hex;
  }

  function confirmLink(id, token) {
    var join = APPS_SCRIPT_URL.indexOf("?") === -1 ? "?" : "&";
    return APPS_SCRIPT_URL + join + "action=confirm&id=" + encodeURIComponent(id) + "&t=" + encodeURIComponent(token);
  }

  function withStaffConfirm(message, id, token) {
    if (!APPS_SCRIPT_URL || !token) return message;
    return message + "\n\n✅ Pour confirmer, appuyez ici :\n" + confirmLink(id, token);
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
      nom_client: record.guest && record.guest.name ? record.guest.name : "",
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
      example: true
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
    return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
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
      ? text("2 véhicules · " + q.loads[0] + "+" + q.loads[1] + " pers. ", "2 vehicles · " + q.loads[0] + "+" + q.loads[1] + " guests ")
      : text("1 véhicule · " + (q.loads[0] <= 4 ? "1–4" : "5–8") + " pers. ", "1 vehicle · " + (q.loads[0] <= 4 ? "1–4" : "5–8") + " guests ");
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
      total.textContent = text("Pour plus de 8 passagers, passez à 2 véhicules.", "For more than 8 passengers, switch to 2 vehicles.");
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
      return text("Veuillez choisir une arrivée ou un départ.", "Please choose an arrival or a departure.");
    }
    if (!date || date < todayISO()) {
      setInvalid(form, "date", true);
      return text("Veuillez indiquer une date à venir.", "Please enter a date that is not in the past.");
    }
    if (!time) {
      setInvalid(form, "time", true);
      return trip === "arrival"
        ? text("Veuillez indiquer l’heure d’arrivée du vol.", "Please enter the flight arrival time.")
        : text("Veuillez indiquer l’heure de prise en charge.", "Please enter the pick-up time at the villa.");
    }
    if (!passengers) {
      setInvalid(form, "passengers", true);
      return text("Veuillez indiquer le nombre de passagers.", "Please enter the number of passengers.");
    }
    if ((Number(form.querySelector("[name='vehicles']").value) || 1) === 1 && Number(passengers) > rates.maxPassengers) {
      return text("Pour plus de 8 passagers, passez à 2 véhicules.", "For more than 8 passengers, switch to 2 vehicles.");
    }
    if (luggage === "" || Number(luggage) < 0) {
      setInvalid(form, "luggage", true);
      return text("Veuillez indiquer le nombre de bagages.", "Please enter the number of bags.");
    }
    if (askFlight && !flight) {
      setInvalid(form, "flight_number", true);
      return text("Veuillez indiquer le numéro de vol.", "Please enter the flight number.");
    }
    if (askFlight && originEl) {
      if (!origin) {
        setInvalid(form, "origin_city", true);
        return trip === "arrival"
          ? text("Veuillez indiquer la ville de provenance.", "Please enter the city of origin.")
          : text("Veuillez indiquer la destination.", "Please enter the destination.");
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
        ? text("Heure d’arrivée du vol", "Flight arrival time")
        : text("Heure de prise en charge", "Pick-up time");
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
        return text("Véhicule ", "Vehicle ") + (index + 1) + " · " + count + text(" pers. ", " guests ") + money(bandAmount(count));
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
      ? "Aéroport RAK → " + villa
      : villa + " → Aéroport RAK";
    var time = data.fields.flight_arrival_time || data.fields.pickup_time;
    var rows = [
      [text("Trajet", "Trip"), trip],
      [text("Date", "Date"), formatDate(data.fields.date)],
      [arrival ? text("Heure d’arrivée du vol", "Flight arrival time") : text("Heure de prise en charge", "Pick-up time"), time]
    ];
    if (data.fields.flight_number) rows.push([text("Vol", "Flight"), data.fields.flight_number]);
    if (data.fields.origin_city) rows.push([text("Ville de provenance", "City of origin"), data.fields.origin_city]);
    rows.push(
      [text("Passagers", "Passengers"), String(data.fields.passengers)],
      [text("Bagages", "Luggage"), String(data.fields.luggage)],
      [text("Véhicules", "Vehicles"), String(data.fields.vehicles || 1)],
      [text("Sièges bébé", "Baby seats"), String(data.fields.baby_seats || 0)],
      [text("Total", "Total"), money(data.price.total)]
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

  function closing() {
    return text("Merci d’avance.", "Thank you in advance.");
  }

  function transferMessage(guest, fields, price) {
    var arrival = fields.trip_type === "arrival";
    var villa = guest.villa || "Villa Zen’O";
    var lines = [
      "Bonjour,",
      "",
      arrival
        ? text(
          "Je séjournerai prochainement à la " + villa + " et souhaite réserver un transfert depuis l’aéroport RAK.",
          "I will soon be staying at " + villa + " and would like to reserve a transfer from RAK airport."
        )
        : text(
          "Je séjourne actuellement à la " + villa + " et souhaite réserver un transfert vers l’aéroport RAK.",
          "I am currently staying at " + villa + " and would like to reserve a transfer to RAK airport."
        ),
      "",
      text("Nom : ", "Name: ") + guest.name,
      text("Trajet : ", "Journey: ") + (arrival ? "Aéroport RAK → " + villa : villa + " → Aéroport RAK"),
      text("Date : ", "Date: ") + formatDate(fields.date),
      (arrival ? text("Heure d’arrivée du vol : ", "Flight arrival time: ") : text("Heure de prise en charge : ", "Pick-up time: ")) + clock(fields.flight_arrival_time || fields.pickup_time),
      text("Passagers : ", "Passengers: ") + fields.passengers,
      text("Bagages : ", "Luggage: ") + fields.luggage,
      text("Véhicules : ", "Vehicles: ") + fields.vehicles
    ];
    if (fields.flight_number) lines.push(text("Vol : ", "Flight: ") + fields.flight_number);
    if (fields.origin_city) lines.push(text("Ville de provenance : ", "City of origin: ") + fields.origin_city);
    lines.push(
      text("Sièges bébé : ", "Baby seats: ") + (fields.baby_seats ? fields.baby_seats : text("Aucun", "None"))
    );
    if (fields.comment) lines.push(text("Commentaire : ", "Comment: ") + fields.comment);
    lines.push(text("Total : ", "Total: ") + money(price.total), "", closing());
    return lines.join("\n");
  }

  function cityMessage(guest, fields) {
    return [
      "Bonjour,",
      "",
      text(
        "Je séjourne actuellement à la " + guest.villa + " et souhaite réserver une course en ville.",
        "I am currently staying at " + guest.villa + " and would like to reserve a city ride."
      ),
      "",
      text("Nom : ", "Name: ") + guest.name,
      text("Nombre de personnes : ", "Number of guests: ") + fields.passengers,
      text("Date de prise en charge : ", "Pick-up date: ") + formatDate(fields.date),
      text("Heure de prise en charge : ", "Pick-up time: ") + fields.pickup_time,
      text("Destination : ", "Destination: ") + fields.destination,
      "",
      text("Pourriez-vous m’indiquer le tarif de cette course ?", "Could you tell me the fare for this ride?"),
      "",
      closing()
    ].join("\n");
  }

  function cityUrl(guest, fields) {
    return requestWhatsApp(RECIPIENTS.hicham, cityMessage(guest, fields));
  }

  function rentalMessage(guest, fields) {
    var typeLabel = fields.car_type === "4x4" ? "4×4" : text("Citadine", "City car");
    var delivery = fields.delivery === "airport"
      ? text("À l’aéroport", "To the airport")
      : text("À la villa", "To the villa");
    var usage = fields.usage === "excursion"
      ? "Excursion"
      : text("À Marrakech", "In Marrakech");
    var when = fields.pickup_time
      ? text(
        "Prise en charge : " + formatDate(fields.start_date) + " à " + fields.pickup_time + "\nRestitution : " + formatDate(fields.end_date) + " à " + fields.return_time,
        "Pick-up: " + formatDate(fields.start_date) + " at " + fields.pickup_time + "\nReturn: " + formatDate(fields.end_date) + " at " + fields.return_time
      )
      : text(
        "Début : " + fields.start_date + "\nFin : " + fields.end_date,
        "Start: " + fields.start_date + "\nEnd: " + fields.end_date
      );
    var lines = [
      "Bonjour,",
      "",
      text(
        "Je séjourne actuellement à la " + guest.villa + " et souhaite réserver un véhicule auprès de l’agence Massillya.",
        "I am currently staying at " + guest.villa + " and would like to reserve a car with Massillya."
      ),
      "",
      text("Nom : ", "Name: ") + guest.name,
      when,
      text("Véhicule : ", "Vehicle: ") + typeLabel,
      text("Livraison : ", "Delivery: ") + delivery,
      text("Parcours : ", "Journey: ") + usage
    ];
    if (fields.comment) lines.push(text("Commentaire : ", "Comment: ") + fields.comment);
    lines.push("", text("Pourriez-vous m’indiquer le tarif et les disponibilités ?", "Could you tell me the rate and the availability?"), "", closing());
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
      return text("Veuillez indiquer entre 1 et 8 personnes.", "Please enter between 1 and 8 people.");
    }
    if (!date || date < todayISO()) {
      setInvalid(form, "date", true);
      return text("Veuillez indiquer une date de prise en charge à venir.", "Please enter a pick-up date that is not in the past.");
    }
    if (!time) {
      setInvalid(form, "time", true);
      return text("Veuillez indiquer l’heure de prise en charge.", "Please enter the pick-up time.");
    }
    if (!destination) {
      setInvalid(form, "destination", true);
      return text("Veuillez indiquer la destination.", "Please enter the destination.");
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
      return text("Veuillez indiquer une date de prise en charge à venir.", "Please enter a pick-up date that is not in the past.");
    }
    if (hasTime && !startTime) {
      setInvalid(form, "pickup_time", true);
      return text("Veuillez indiquer l’heure de prise en charge.", "Please enter the pick-up time.");
    }
    if (!end || end < start) {
      setInvalid(form, "end_date", true);
      return text("La restitution doit suivre la prise en charge.", "The return must be after the pick-up.");
    }
    if (hasTime && !endTime) {
      setInvalid(form, "return_time", true);
      return text("Veuillez indiquer l’heure de restitution.", "Please enter the return time.");
    }
    if (hasTime && end === start && endTime <= startTime) {
      setInvalid(form, "return_time", true);
      return text("L’heure de restitution doit être postérieure à la prise en charge.", "The return time must be after the pick-up.");
    }
    if (!type) return text("Veuillez choisir une citadine ou un 4×4.", "Please choose a city car or a 4×4.");
    if (!delivery) return text("Veuillez préciser le lieu de livraison.", "Please choose where the car should be delivered.");
    if (!usage) return text("Veuillez préciser le parcours.", "Please choose the type of journey.");
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
    showSegment(root, "airport");

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
        postToSheet(sheetPayload(record, record.token, data.fields.trip_type === "departure" ? "départ" : "arrivée", "Hicham", rows));
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
          [text("Personnes", "People"), String(fields.passengers)],
          [text("Date", "Date"), formatDate(fields.date)],
          [text("Heure de prise en charge", "Pick-up time"), fields.pickup_time],
          [text("Destination", "Destination"), fields.destination]
        ];
        var record = baseRecord("course", guest, fields, null);
        record.token = newToken();
        fields.message = withStaffConfirm(cityMessage(guest, fields), record.id, record.token);
        submitRequest(record);
        openGuestWhatsApp(requestWhatsApp(RECIPIENTS.hicham, fields.message));
        postToSheet(sheetPayload(record, record.token, "en ville", "Hicham", rows));
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
          [text("Prise en charge", "Pick-up"), formatDate(fields.start_date) + " · " + fields.pickup_time],
          [text("Restitution", "Return"), formatDate(fields.end_date) + " · " + fields.return_time],
          [text("Véhicule", "Vehicle"), fields.car_type === "4x4" ? "4×4" : text("Citadine", "City car")],
          [text("Livraison", "Delivery"), fields.delivery === "airport" ? text("À l’aéroport", "To the airport") : text("À la villa", "To the villa")],
          [text("Parcours", "Journey"), fields.usage === "excursion" ? "Excursion" : text("À Marrakech", "In Marrakech")]
        ];
        if (fields.comment) rentalRows.push([text("Commentaire", "Comment"), fields.comment]);
        var record = baseRecord("location_voiture", guest, fields, null);
        record.token = newToken();
        fields.message = withStaffConfirm(rentalMessage(guest, fields), record.id, record.token);
        submitRequest(record);
        openGuestWhatsApp(requestWhatsApp(RECIPIENTS.massillya, fields.message));
        postToSheet(sheetPayload(record, record.token, fields.car_type === "4x4" ? "4x4" : "citadine", "Massillya", rentalRows));
        showReceived(root, rentalRows);
      });
    }
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
