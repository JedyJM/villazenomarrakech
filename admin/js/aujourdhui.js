/* Admin Aujourd'hui. French. Test day is 16 December 2026. */
(function () {
  "use strict";

  var sample = window.AdminSample;
  var WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.7 1.7 0 0 0 3.4 0"/></svg>';

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDay(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function dayText(date) { return date.getDate() + "\u00A0" + MONTHS[date.getMonth()]; }
  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function patches() {
    try { return JSON.parse(sessionStorage.getItem("vz.admin.demandes") || "{}"); } catch (e) { return {}; }
  }
  function requests() {
    var extra = patches();
    return sample.requests().map(function (item) { return Object.assign({}, item, extra[item.id] || {}); });
  }
  function since(item) {
    var min = Math.round((Date.now() - item.created) / 60000);
    if (min < 60) return "depuis " + Math.max(min, 1) + "\u00A0min";
    var hours = Math.round(min / 60);
    if (hours < 48) return "depuis " + hours + "\u00A0h";
    return "depuis " + Math.round(hours / 24) + "\u00A0j";
  }
  function chipClass(status) {
    if (status === "Confirmée") return "status-confirmee";
    if (status === "Terminée") return "status-terminee";
    if (status === "Annulée") return "status-annulee";
    return "status-envoyee";
  }
  function dotClass(status) {
    if (status === "Confirmée") return "is-gold";
    if (status === "Terminée") return "is-grey";
    return "is-terra";
  }
  function daysBetween(a, b) {
    return Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / 86400000);
  }

  function boot() {
    var root = document.querySelector("[data-today]");
    if (!root || document.body.classList.contains("is-locked") || !sample) return;
    var day = sample.today();
    var book = sample.stays();
    var empty = query("vide") === "1";
    var current = empty ? null : book.current;
    var next = book.next;
    var items = empty ? [] : requests();
    var todayKey = isoDay(day);

    root.querySelector("[data-date]").textContent = WEEK[day.getDay()] + " " + day.getDate() + "\u00A0" + MONTHS[day.getMonth()] + "\u00A0" + day.getFullYear();

    var stay = root.querySelector("[data-stay]");
    if (!current) {
      stay.classList.add("is-empty");
      stay.removeAttribute("href");
      stay.innerHTML = '<p class="kicker">Séjour en cours</p><p class="stay-empty">Aucun séjour en cours</p><p class="stay-next">Prochaine arrivée · ' + esc(next.name) + " · " + esc(dayText(next.arrival)) + "</p>";
    } else {
      var night = daysBetween(new Date(current.arrival), new Date(day)) + 1;
      var width = Math.round(night / current.nights * 100);
      stay.href = "sejour.html?id=" + encodeURIComponent(current.id);
      stay.innerHTML = '<p class="kicker">Séjour en cours</p>'
        + '<p class="stay-who"><span>' + esc(current.name) + '</span><span class="chip is-cours">En cours</span></p>'
        + '<p class="stay-dates">' + esc(dayText(current.arrival)) + " → " + esc(dayText(current.departure)) + "\u00A0" + current.departure.getFullYear() + "</p>"
        + '<p class="stay-meta"><span>Nuit ' + night + "/" + current.nights + '</span><span>' + current.adults + " ad. · " + current.children + " enf. · " + esc(current.source) + "</span></p>"
        + '<span class="stay-bar" aria-hidden="true"><span style="width:' + width + '%"></span></span>';
    }

    var depart = root.querySelector("[data-depart]");
    var arrive = root.querySelector("[data-arrive]");
    if (current) {
      var left = daysBetween(new Date(day), new Date(current.departure));
      depart.href = "sejour.html?id=" + encodeURIComponent(current.id);
      depart.innerHTML = '<p class="kicker">Départ</p><strong>' + esc(current.name) + '</strong><span>' + esc(dayText(current.departure)) + " · dans " + left + "\u00A0jours</span>";
    } else {
      depart.removeAttribute("href");
      depart.innerHTML = '<p class="kicker">Départ</p><strong>Aucun</strong><span>Pas de départ prévu</span>';
    }
    arrive.href = "sejour.html?id=" + encodeURIComponent(next.id);
    arrive.innerHTML = '<p class="kicker">Arrivée</p><strong>' + esc(next.name) + '</strong><span>' + esc(dayText(next.arrival)) + " · " + esc(next.source) + " · " + next.nights + "\u00A0j</span>";

    var alerts = items.filter(function (item) {
      return item.status === "Envoyée" && isoDay(item.when) >= todayKey;
    }).sort(function (a, b) { return a.when - b.when; });
    var alertBox = root.querySelector("[data-alerts]");
    root.querySelector("[data-alert-count]").textContent = String(alerts.length);
    alertBox.innerHTML = alerts.length ? alerts.map(function (item) {
      var when = isoDay(item.when) === todayKey ? "aujourd’hui" : dayText(item.when);
      return '<a class="alert-row" href="demandes.html?open=' + encodeURIComponent(item.id) + '"><span class="alert-ico">' + BELL + '</span><span><strong>' + esc(item.label) + " · " + esc(when) + " · " + pad(item.when.getHours()) + ":" + pad(item.when.getMinutes()) + '</strong><em><b>Envoyée</b> ' + esc(since(item)) + " · " + esc(item.staff) + "</em></span></a>";
    }).join("") : '<p class="today-empty">Aucune alerte</p>';

    var services = items.filter(function (item) { return isoDay(item.when) === todayKey; }).sort(function (a, b) { return a.when - b.when; });
    var serviceBox = root.querySelector("[data-services]");
    serviceBox.innerHTML = services.length ? services.map(function (item) {
      return '<p class="svc-row"><span class="svc-time">' + pad(item.when.getHours()) + ":" + pad(item.when.getMinutes()) + '</span><span class="svc-dot ' + dotClass(item.status) + '"></span><span class="svc-name">' + esc(item.label) + " · " + esc(item.staff) + '</span><span class="req-chip ' + chipClass(item.status) + '">' + esc(item.status) + "</span></p>";
    }).join("") : '<p class="today-empty">Aucun service</p>';
  }
  function chipClass(status) {
    if (status === "Confirmée") return "status-confirmee";
    if (status === "Terminée") return "status-terminee";
    if (status === "Annulée") return "status-annulee";
    return "status-envoyee";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
