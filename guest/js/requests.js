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
    var qty = Math.max(0, Math.min(2, Number(babyQty) || 0));
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

  function summary(q) {
    if (!q.ready) {
      return text(
        "1–4 pers. 350 DH · 5–8 pers. 450 DH · siège bébé 50 DH",
        "1–4 guests 350 MAD · 5–8 guests 450 MAD · baby seat 50 MAD"
      );
    }
    if (q.blocked) return text("Contactez la villa", "Contact the villa");
    var band = q.band === "1-4"
      ? text("Transfert 1-4 pers. ", "Transfer 1-4 guests ")
      : text("Transfert 5-8 pers. ", "Transfer 5-8 guests ");
    var line = band + money(q.price_base);
    if (q.supplements.length) {
      line += text(" · Siège bébé +", " · Baby seat +") + money(q.supplements[0].amount_mad);
    }
    line += text(" · Total ", " · Total ") + money(q.total);
    return line;
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

  function readTransfer(form) {
    var trip = selectedTrip(form);
    var babyOn = form.querySelector("[name='baby_seat']").checked;
    var babyQty = babyOn ? Number(form.querySelector("[name='baby_seat_qty']").value) : 0;
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
      baby_seat: babyOn,
      baby_seat_qty: babyQty,
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
    var airport = trip === "arrival" || trip === "departure";
    var city = document.querySelector("[data-request-page] [data-city]");
    var airportBox = form.querySelector("[data-airport]");
    if (city) city.hidden = trip !== "city";
    if (airportBox) airportBox.hidden = !airport;
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
    form.querySelector("[data-baby-qty]").hidden = !babyOn;
    var price = quote(form.querySelector("[name='passengers']").value, babyOn ? form.querySelector("[name='baby_seat_qty']").value : 0);
    var line = form.querySelector("[data-price]");
    if (line) line.textContent = airport || !trip ? summary(price) : "";
    var button = form.querySelector("[data-transfer-submit]");
    if (button) button.disabled = !!(airport && price.blocked);
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
    var delivery = fields.delivery === "yes"
      ? text("oui", "yes")
      : text("non", "no");
    var typeLabel = {
      citadine: text("citadine", "city car"),
      suv: "SUV",
      monospace: text("monospace", "people carrier"),
      other: text("autre", "other")
    }[fields.car_type] || fields.car_type;
    return text(
      "Bonjour Papa,\nJe souhaite louer une voiture avec Massillya.\nNom : " + guest.name + "\nVilla : " + guest.villa + "\nDébut : " + fields.start_date + "\nFin : " + fields.end_date + "\nVéhicule : " + typeLabel + "\nPersonnes : " + fields.people + "\nLivraison à la villa : " + delivery + "\nCommentaire : " + (fields.comment || "—"),
      "Hello Papa,\nI would like to rent a car with Massillya.\nName: " + guest.name + "\nVilla: " + guest.villa + "\nStart: " + fields.start_date + "\nEnd: " + fields.end_date + "\nVehicle: " + typeLabel + "\nPeople: " + fields.people + "\nDelivery to the villa: " + delivery + "\nComment: " + (fields.comment || "—")
    );
  }

  function rentalUrl(guest, fields) {
    return "https://wa.me/212616172974?text=" + encodeURIComponent(rentalMessage(guest, fields));
  }

  function validateRental(form) {
    clearInvalid(form);
    var start = form.querySelector("[name='start_date']").value;
    var end = form.querySelector("[name='end_date']").value;
    var type = form.querySelector("[name='car_type']").value;
    var people = form.querySelector("[name='people']").value;
    var delivery = form.querySelector("input[name='delivery']:checked");
    if (!start || start < todayISO()) {
      setInvalid(form, "start_date", true);
      return text("Indiquez une date de début à venir.", "Enter a start date that is not in the past.");
    }
    if (!end || end < start) {
      setInvalid(form, "end_date", true);
      return text("La fin doit être le même jour ou après le début.", "The end date must be on or after the start.");
    }
    if (!type) {
      setInvalid(form, "car_type", true);
      return text("Choisissez un type de voiture.", "Choose a car type.");
    }
    if (!people) {
      setInvalid(form, "people", true);
      return text("Indiquez le nombre de personnes.", "Enter the number of people.");
    }
    if (!delivery) return text("Indiquez si la voiture est livrée à la villa.", "Say whether the car should be delivered to the villa.");
    return "";
  }

  function readRental(form, guest) {
    return {
      start_date: form.querySelector("[name='start_date']").value,
      end_date: form.querySelector("[name='end_date']").value,
      car_type: form.querySelector("[name='car_type']").value,
      people: Number(form.querySelector("[name='people']").value),
      delivery: form.querySelector("input[name='delivery']:checked").value,
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
    root.querySelectorAll("input[type='date']").forEach(function (input) {
      input.min = today;
    });

    if (transfer) {
      var errorNode = transfer.querySelector("[data-errors]");
      syncTransfer(transfer);
      transfer.addEventListener("change", function () { syncTransfer(transfer); });
      transfer.addEventListener("input", function () { syncTransfer(transfer); });
      transfer.addEventListener("submit", function (event) {
        event.preventDefault();
        var message = validateTransfer(transfer);
        showError(errorNode, message);
        if (message) return;
        var data = readTransfer(transfer);
        submitRequest(baseRecord("transfert", data.guest, data.fields, data.price));
        root.querySelector("[data-flow]").hidden = true;
        var done = root.querySelector("[data-confirm]");
        done.hidden = false;
        done.scrollIntoView({ block: "start" });
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
    summary: summary,
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
