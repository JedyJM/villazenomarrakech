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

  var stay = {
    name: "Invité",
    phone: "+212 600 000 000",
    villa: "Villa Zen’O",
    example: true
  };

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

  function guestFrom(form) {
    var name = form.querySelector("[name='guest_name']");
    var phone = form.querySelector("[name='guest_phone']");
    return {
      name: name ? name.value.trim() : stay.name,
      phone: phone ? phone.value.trim() : stay.phone,
      villa: stay.villa
    };
  }

  function quote(passengers, babyQty) {
    var n = Number(passengers);
    if (!n) return { ready: false, blocked: false };
    if (n > rates.maxPassengers) return { ready: true, blocked: true };
    var base = n <= 4 ? rates.bandSmall : rates.bandLarge;
    var qty = Math.max(0, Math.min(3, Number(babyQty) || 0));
    var amount = qty * rates.babySeat;
    return {
      ready: true,
      blocked: false,
      band: n <= 4 ? "1-4" : "5-8",
      price_base: base,
      supplements: qty ? [{ code: "baby_seat", quantity: qty, unit_mad: rates.babySeat, amount_mad: amount }] : [],
      total: base + amount,
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
    if (!q.ready || q.blocked) return "";
    var band = q.band === "1-4"
      ? text("Transfert 1–4 pers. ", "Transfer 1–4 guests ")
      : text("Transfert 5–8 pers. ", "Transfer 5–8 guests ");
    var line = band + money(q.price_base);
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
    if (q.blocked) {
      total.textContent = text("Contactez la villa", "Contact the villa");
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
    var price = quote(passengers, babyQty);
    var villa = form.querySelector("[name='villa']").value.trim();
    var fields = {
      trip_type: trip,
      date: form.querySelector("[name='date']").value,
      flight_arrival_time: trip === "arrival" ? form.querySelector("[name='time']").value : "",
      pickup_time: trip === "departure" ? form.querySelector("[name='time']").value : "",
      passengers: Number(passengers) || null,
      luggage: form.querySelector("[name='luggage']").value === "" ? null : Number(form.querySelector("[name='luggage']").value),
      flight_number: form.querySelector("[name='flight_number']").value.trim(),
      arrival_villa: trip === "arrival" ? villa : "",
      pickup_villa: trip === "departure" ? villa : "",
      baby_seat: babyQty > 0,
      baby_seats: babyQty,
      comment: form.querySelector("[name='comment']").value.trim()
    };
    return { fields: fields, price: price, guest: guestFrom(form) };
  }

  function validateTransfer(form) {
    clearInvalid(form);
    var trip = selectedTrip(form);
    var date = form.querySelector("[name='date']").value;
    var time = form.querySelector("[name='time']").value;
    var passengers = form.querySelector("[name='passengers']").value;
    var luggage = form.querySelector("[name='luggage']").value;
    var flight = form.querySelector("[name='flight_number']").value.trim();
    var villa = form.querySelector("[name='villa']").value.trim();
    if (trip !== "arrival" && trip !== "departure") {
      return text("Choisissez une arrivée ou un départ.", "Choose an arrival or a departure.");
    }
    if (!date || date < todayISO()) {
      setInvalid(form, "date", true);
      return text("Indiquez une date à venir.", "Enter a date that is not in the past.");
    }
    if (!time) {
      setInvalid(form, "time", true);
      return trip === "arrival"
        ? text("Indiquez l’heure d’arrivée du vol.", "Enter the flight arrival time.")
        : text("Indiquez l’heure de prise en charge.", "Enter the pick-up time.");
    }
    if (!passengers) {
      setInvalid(form, "passengers", true);
      return text("Indiquez le nombre de passagers.", "Enter the number of passengers.");
    }
    if (Number(passengers) > rates.maxPassengers) {
      setInvalid(form, "passengers", true);
      return text("Contactez la villa", "Contact the villa");
    }
    if (luggage === "" || Number(luggage) < 0) {
      setInvalid(form, "luggage", true);
      return text("Indiquez le nombre de bagages.", "Enter the number of bags.");
    }
    if (!flight) {
      setInvalid(form, "flight_number", true);
      return text("Indiquez le numéro de vol.", "Enter the flight number.");
    }
    if (!villa) {
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
    if (villaLabel) {
      villaLabel.textContent = trip === "departure"
        ? text("Villa de départ", "Departure villa")
        : text("Villa d’arrivée", "Arrival villa");
    }
    var babyOn = form.querySelector("[name='baby_seat']").checked;
    var seats = form.querySelector("[name='baby_seats']");
    if (babyOn && Number(seats.value) < 1) seats.value = "1";
    form.querySelector("[data-baby-step]").hidden = !babyOn;
    var count = babyOn ? Number(seats.value) : 0;
    form.querySelector("[data-baby-count]").textContent = String(count || 1);
    form.querySelector("[data-baby-dec]").disabled = count <= 1;
    form.querySelector("[data-baby-inc]").disabled = count >= 3;
    var price = quote(form.querySelector("[name='passengers']").value, count);
    renderPrice(form.querySelector("[data-price-box]"), price);
    var button = form.querySelector("[data-transfer-submit]");
    if (button) button.disabled = !!price.blocked;
  }

  function showSegment(root, name) {
    root.querySelectorAll("[data-show]").forEach(function (button) {
      button.setAttribute("aria-selected", button.getAttribute("data-show") === name ? "true" : "false");
    });
    root.querySelectorAll("[data-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== name;
    });
    var lead = root.querySelector("[data-segment-lead]");
    var leads = {
      airport: text(
        "Aéroport de Marrakech · environ 35 min · règlement en espèces au chauffeur",
        "Marrakech airport · about 35 min · payment in cash to the driver"
      ),
      city: text(
        "Avec Hicham · règlement en espèces au chauffeur",
        "With Hicham · payment in cash to the driver"
      ),
      rental: ""
    };
    if (lead) {
      lead.textContent = leads[name] || "";
      lead.hidden = !leads[name];
    }
  }

  function fillConfirmation(node, data) {
    var trip = data.fields.trip_type === "arrival"
      ? text("Arrivée aéroport → villa", "Airport arrival → villa")
      : text("Départ villa → aéroport", "Villa → airport departure");
    var time = data.fields.flight_arrival_time || data.fields.pickup_time;
    var rows = [
      [text("Trajet", "Trip"), trip],
      [text("Date", "Date"), formatDate(data.fields.date)],
      [text("Heure", "Time"), time],
      [text("Vol", "Flight"), data.fields.flight_number],
      [text("Passagers", "Passengers"), String(data.fields.passengers)],
      [text("Sièges bébé", "Baby seats"), String(data.fields.baby_seats || 0)],
      [text("Total", "Total"), money(data.price.total)]
    ];
    node.innerHTML = rows.map(function (row) {
      return "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>";
    }).join("");
  }

  function cityMessage(guest) {
    var name = guest.name || stay.name;
    var villa = guest.villa || stay.villa;
    return text(
      "Bonjour Hicham, je suis " + name + ", à la " + villa + ". Je souhaite réserver une course.\nDate : …\nHeure : …\nDestination : …",
      "Hello Hicham, I am " + name + ", at " + villa + ". I would like to book a ride.\nDate: …\nTime: …\nDestination: …"
    );
  }

  function cityUrl(guest) {
    return "https://wa.me/212661775422?text=" + encodeURIComponent(cityMessage(guest));
  }

  function rentalMessage(guest, fields) {
    var typeLabel = fields.car_type === "4x4" ? "4x4" : text("Citadine", "City car");
    var delivery = fields.delivery === "airport"
      ? text("À l’aéroport", "To the airport")
      : text("À la villa", "To the villa");
    var usage = fields.usage === "excursion"
      ? "Excursion"
      : text("Dans Marrakech", "In Marrakech");
    return text(
      "Bonjour Papa,\nJe souhaite louer une voiture avec Massillya.\nNom : " + guest.name + "\nVilla : " + guest.villa + "\nDébut : " + fields.start_date + "\nFin : " + fields.end_date + "\nVéhicule : " + typeLabel + "\nPersonnes : " + fields.people + "\nLivraison : " + delivery + "\nUtilisation : " + usage + "\nCommentaire : " + (fields.comment || "—"),
      "Hello Papa,\nI would like to rent a car with Massillya.\nName: " + guest.name + "\nVilla: " + guest.villa + "\nStart: " + fields.start_date + "\nEnd: " + fields.end_date + "\nVehicle: " + typeLabel + "\nPeople: " + fields.people + "\nDelivery: " + delivery + "\nUse: " + usage + "\nComment: " + (fields.comment || "—")
    );
  }

  function rentalUrl(guest, fields) {
    return "https://wa.me/212616172974?text=" + encodeURIComponent(rentalMessage(guest, fields));
  }

  function validateRental(form) {
    clearInvalid(form);
    var start = form.querySelector("[name='start_date']").value;
    var end = form.querySelector("[name='end_date']").value;
    var type = form.querySelector("input[name='car_type']:checked");
    var people = form.querySelector("[name='people']").value;
    var delivery = form.querySelector("input[name='delivery']:checked");
    var usage = form.querySelector("input[name='usage']:checked");
    if (!start || start < todayISO()) {
      setInvalid(form, "start_date", true);
      return text("Indiquez une date de début à venir.", "Enter a start date that is not in the past.");
    }
    if (!end || end < start) {
      setInvalid(form, "end_date", true);
      return text("La fin doit être le même jour ou après le début.", "The end date must be on or after the start.");
    }
    if (!type) {
      return text("Choisissez Citadine ou 4x4.", "Choose a city car or a 4x4.");
    }
    if (!people) {
      setInvalid(form, "people", true);
      return text("Indiquez le nombre de personnes.", "Enter the number of people.");
    }
    if (!delivery) return text("Choisissez la livraison : à la villa ou à l’aéroport.", "Choose delivery to the villa or to the airport.");
    if (!usage) return text("Choisissez l’utilisation.", "Choose how the car will be used.");
    return "";
  }

  function readRental(form, guest) {
    return {
      start_date: form.querySelector("[name='start_date']").value,
      end_date: form.querySelector("[name='end_date']").value,
      car_type: form.querySelector("input[name='car_type']:checked").value,
      people: Number(form.querySelector("[name='people']").value),
      delivery: form.querySelector("input[name='delivery']:checked").value,
      usage: form.querySelector("input[name='usage']:checked").value,
      comment: form.querySelector("[name='comment']").value.trim(),
      agency: "Massillya",
      contact: "Papa"
    };
  }

  function openGuestWhatsApp(url) {
    var opened = window.open(url, "_blank", "noopener");
    if (!opened) window.location.href = url;
  }

  function init() {
    if (isEn()) stay.name = "Guest";
    var root = document.querySelector("[data-request-page]");
    if (!root) return;
    var transfer = root.querySelector("[data-transfer-form]");
    var rental = root.querySelector("[data-rental-form]");
    var nameInput = root.querySelector("[name='guest_name']");
    var phoneInput = root.querySelector("[name='guest_phone']");
    if (nameInput && !nameInput.value) nameInput.value = stay.name;
    if (phoneInput && !phoneInput.value) phoneInput.value = stay.phone;
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
      transfer.querySelector("[data-baby-dec]").addEventListener("click", function () {
        var input = transfer.querySelector("[name='baby_seats']");
        input.value = String(Math.max(1, Number(input.value) - 1));
        syncTransfer(transfer);
      });
      transfer.querySelector("[data-baby-inc]").addEventListener("click", function () {
        var input = transfer.querySelector("[name='baby_seats']");
        input.value = String(Math.min(3, Number(input.value) + 1));
        syncTransfer(transfer);
      });
      transfer.addEventListener("change", function () { syncTransfer(transfer); });
      transfer.addEventListener("input", function () { syncTransfer(transfer); });
      transfer.addEventListener("submit", function (event) {
        event.preventDefault();
        var message = validateTransfer(transfer);
        showError(errorNode, message);
        if (message) return;
        var data = readTransfer(transfer);
        submitRequest(baseRecord("transfert", data.guest, data.fields, data.price));
        transfer.hidden = true;
        var done = root.querySelector("[data-confirm]");
        fillConfirmation(done.querySelector("[data-confirm-list]"), data);
        done.hidden = false;
      });
      var cityLink = root.querySelector("[data-city-link]");
      if (cityLink) {
        cityLink.href = cityUrl(guestFrom(transfer));
        cityLink.addEventListener("click", function () {
          var guest = guestFrom(transfer);
          var message = cityMessage(guest);
          cityLink.href = cityUrl(guest);
          submitRequest(baseRecord("course", guest, {
            channel: "whatsapp",
            to: "Hicham",
            phone: "212661775422",
            message: message
          }, null));
        });
      }
    }

    if (rental) {
      var rentalError = rental.querySelector("[data-errors]");
      rental.addEventListener("submit", function (event) {
        event.preventDefault();
        var message = validateRental(rental);
        showError(rentalError, message);
        if (message) return;
        var guest = {
          name: (nameInput && nameInput.value.trim()) || stay.name,
          phone: (phoneInput && phoneInput.value.trim()) || stay.phone,
          villa: stay.villa
        };
        var fields = readRental(rental, guest);
        var url = rentalUrl(guest, fields);
        fields.message = rentalMessage(guest, fields);
        submitRequest(baseRecord("location_voiture", guest, fields, null));
        openGuestWhatsApp(url);
      });
    }
  }

  window.GuestRequests = {
    config: config,
    quote: quote,
    breakdown: breakdown,
    formatDate: formatDate,
    submitRequest: submitRequest,
    cityUrl: cityUrl,
    rentalUrl: rentalUrl
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
