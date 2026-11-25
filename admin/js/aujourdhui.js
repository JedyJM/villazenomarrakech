/* Admin Aujourd'hui. French. Real data only (AdminSample is empty). */
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

  function isoText(iso, withYear) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return "";
    return Number(p[2]) + "\u00A0" + MONTHS[Number(p[1]) - 1] + (withYear ? "\u00A0" + p[0] : "");
  }
  function firstName(nom) { return String(nom || "").trim().split(/\s+/)[0] || ""; }
  function people(stay) {
    return (stay.adults || 0) + " ad. · " + (stay.children || 0) + " enf. · " + (window.AdminStays ? window.AdminStays.sourceLabel(stay) : String(stay.source || ""));
  }
  // Current stay: arrival ≤ today < departure. Next: earliest arrival after
  // today (or a second stay already started, should two overlap).
  function pickStays(todayKey) {
    var list = (window.AdminStays ? window.AdminStays.all() : []).filter(function (stay) {
      return !stay.hidden && stay.arrival && stay.departure && stay.departure > stay.arrival;
    }).sort(function (a, b) { return String(a.arrival).localeCompare(String(b.arrival)); });
    var current = null;
    var next = null;
    list.forEach(function (stay) {
      if (stay.arrival <= todayKey && todayKey < stay.departure) {
        if (!current) current = stay;
        else if (!next) next = stay;
      } else if (stay.arrival > todayKey && (!next || stay.arrival < next.arrival)) next = stay;
    });
    return { current: current, next: next };
  }
  // Same layout for both cards: kicker, name + chip, dates, meta, bar.
  function stayCard(el, kind, stay, todayKey, loaded) {
    var kicker = kind === "current" ? "Séjour en cours" : "Prochain séjour";
    if (!stay) {
      el.classList.add("is-empty");
      el.removeAttribute("href");
      el.innerHTML = '<p class="kicker">' + kicker + '</p><p class="stay-empty">' + (loaded ? (kind === "current" ? "Aucun séjour en cours" : "Aucun séjour à venir") : "Chargement…") + "</p>";
      return;
    }
    var total = nightsBetween(stay.arrival, stay.departure);
    var left;
    var width = 0;
    var chip;
    if (kind === "current") {
      var night = nightsBetween(stay.arrival, todayKey) + 1;
      width = Math.round(night / total * 100);
      left = "Nuit " + night + "/" + total;
      chip = '<span class="chip is-cours">En cours</span>';
    } else {
      var wait = nightsBetween(todayKey, stay.arrival);
      left = (wait <= 1 ? "Demain" : "Dans " + wait + "\u00A0jours") + " · " + total + "\u00A0nuit" + (total > 1 ? "s" : "");
      chip = '<span class="chip is-venir">À venir</span>';
    }
    el.classList.remove("is-empty");
    el.href = "sejour.html?id=" + encodeURIComponent(stay.id);
    el.innerHTML = '<p class="kicker">' + kicker + "</p>"
      + '<p class="stay-who"><span>' + esc(stay.nom || firstName(stay.nom)) + "</span>" + chip + "</p>"
      + '<p class="stay-dates">' + esc(isoText(stay.arrival)) + " → " + esc(isoText(stay.departure, true)) + "</p>"
      + '<p class="stay-meta"><span>' + esc(left) + "</span><span>" + esc(people(stay)) + "</span></p>"
      + '<span class="stay-bar' + (kind === "current" ? "" : " is-idle") + '" aria-hidden="true"><span style="width:' + width + '%"></span></span>';
  }
  function nightsBetween(a, b) {
    var pa = String(a).split("-");
    var pb = String(b).split("-");
    return Math.round((Date.UTC(+pb[0], pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], pa[1] - 1, +pa[2])) / 86400000);
  }
  function paintStays(root, todayKey, empty, loaded) {
    var pick = empty ? { current: null, next: null } : pickStays(todayKey);
    var current = pick.current;
    var next = pick.next;
    stayCard(root.querySelector("[data-stay]"), "current", current, todayKey, loaded || empty);
    stayCard(root.querySelector("[data-next]"), "next", next, todayKey, loaded || empty);
    var depart = root.querySelector("[data-depart]");
    var arrive = root.querySelector("[data-arrive]");
    if (current) {
      var left = nightsBetween(todayKey, current.departure);
      depart.href = "sejour.html?id=" + encodeURIComponent(current.id);
      depart.innerHTML = '<p class="kicker">Départ</p><strong>' + esc(firstName(current.nom)) + "</strong><span>" + esc(isoText(current.departure)) + " · " + (left <= 1 ? "demain" : "dans " + left + "\u00A0jours") + "</span>";
    } else {
      depart.removeAttribute("href");
      depart.innerHTML = '<p class="kicker">Départ</p><strong>Aucun</strong><span>Pas de départ prévu</span>';
    }
    if (next) {
      arrive.href = "sejour.html?id=" + encodeURIComponent(next.id);
      arrive.innerHTML = '<p class="kicker">Arrivée</p><strong>' + esc(firstName(next.nom)) + "</strong><span>" + esc(isoText(next.arrival)) + " · " + esc(window.AdminStays ? window.AdminStays.sourceLabel(next) : next.source) + "</span>";
    } else {
      arrive.removeAttribute("href");
      arrive.innerHTML = '<p class="kicker">Arrivée</p><strong>Aucune</strong><span>Pas d’arrivée prévue</span>';
    }
  }

  function boot() {
    var root = document.querySelector("[data-today]");
    if (!root || document.body.classList.contains("is-locked") || !sample) return;
    var day = sample.today();
    var empty = query("vide") === "1";
    var items = empty ? [] : requests();
    var todayKey = isoDay(day);

    root.querySelector("[data-date]").textContent = WEEK[day.getDay()] + " " + day.getDate() + "\u00A0" + MONTHS[day.getMonth()] + "\u00A0" + day.getFullYear();
    paintStays(root, todayKey, empty, false);
    // Real Zen'O stays from the daily cache (same feed as Séjours).
    if (window.AdminStays && !empty) window.AdminStays.load(function () { paintStays(root, todayKey, empty, true); });

    var alerts = items.filter(function (item) {
      return item.status === "Envoyée" && isoDay(item.when) >= todayKey;
    }).sort(function (a, b) { return a.when - b.when; });
    var alertBox = root.querySelector("[data-alerts]");
    root.querySelector("[data-alert-count]").textContent = String(alerts.length);
    try { sessionStorage.setItem("vz.admin.confirmer", String(alerts.length)); } catch (e) {}
    var nav = document.querySelector("[data-nav='demandes']");
    if (nav) nav.classList.toggle("has-dot", alerts.length > 0);
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
