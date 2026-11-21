/* Shared test stay and requests. Today is Wednesday 16 December 2026. */
(function () {
  "use strict";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { return new Date(2026, 11, 16); }
  function at(day, hour, minute) {
    var date = today();
    date.setDate(date.getDate() + day);
    date.setHours(hour, minute, 0, 0);
    return date;
  }
  function on(month, day, hour, minute) {
    return new Date(2026, month - 1, day, hour, minute, 0, 0);
  }
  function requests() {
    var now = Date.now();
    return [
      { id: "din21fouz", kind: "dinner", label: "Dîner", adults: 2, children: 2, guest: "Camille Martin", stay: "Camille Martin", staff: "Fouzia", status: "Envoyée", when: at(0, 20, 0), created: now - 47 * 60000, price: "50\u00A0€", token: "din21token" },
      { id: "pdj18fouz", kind: "breakfast", label: "Petit-déjeuner", adults: 2, children: 2, guest: "Camille Martin", stay: "Camille Martin", staff: "Fouzia", status: "Envoyée", when: on(12, 18, 9, 0), created: now - 3 * 3600000, price: "25\u00A0€", token: "pdj18token" },
      { id: "tr19hicha", kind: "car", label: "Transfert", extra: "départ", guest: "Camille Martin", stay: "Camille Martin", staff: "Hicham", status: "Envoyée", when: on(12, 19, 11, 0), created: now - 26 * 3600000, price: "35\u00A0€", dh: "350\u00A0DH", token: "tr19token" },
      { id: "men21nade", kind: "menage", label: "Ménage", guest: "Camille Martin", stay: "Camille Martin", staff: "Nadera", status: "Confirmée", when: at(0, 11, 0), created: now - 5 * 3600000, price: "", token: "men21token" },
      { id: "pdj21fouz", kind: "breakfast", label: "Petit-déjeuner", adults: 2, children: 2, guest: "Camille Martin", stay: "Camille Martin", staff: "Fouzia", status: "Terminée", when: at(0, 8, 30), created: now - 8 * 3600000, price: "25\u00A0€", token: "pdj21token" },
      { id: "qu12khali", kind: "quad", label: "Quad", extra: "1 pers.", guest: "Camille Martin", stay: "Camille Martin", staff: "Khalid", status: "Confirmée", when: on(12, 12, 9, 0), created: now - 9 * 3600000, price: "30\u00A0€", dh: "300\u00A0DH", token: "qu12token" },
      { id: "tr12hicha", kind: "car", label: "Transfert", extra: "arrivée", guest: "Camille Martin", stay: "Camille Martin", staff: "Hicham", status: "Terminée", when: on(12, 12, 14, 30), created: now - 10 * 3600000, price: "35\u00A0€", dh: "350\u00A0DH", token: "tr12token" }
    ];
  }
  function stays() {
    return {
      current: { id: "cmartin26a", name: "Camille Martin", arrival: on(12, 12, 16, 0), departure: on(12, 19, 11, 0), adults: 2, children: 2, source: "Airbnb", nights: 7 },
      next: { id: "imoreau26d", name: "Inès Moreau", arrival: on(12, 22, 16, 0), source: "Direct", nights: 7 }
    };
  }

  window.AdminSample = { today: today, requests: requests, stays: stays, pad: pad };
})();
