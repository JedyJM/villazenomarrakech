(function () {
  "use strict";

  var root = document.getElementById("availability-calendar");
  if (!root) return;

  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2);
  var isEn = lang === "en";
  var i18n = {
    fr: {
      months: ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
      weekdays: ["Lu","Ma","Me","Je","Ve","Sa","Di"],
      legendBusy: "Réservé",
      legendFree: "Disponible",
      updated: "Dernière mise à jour",
      empty: "Calendrier bientôt disponible — contactez-nous sur WhatsApp.",
      sample: "exemple",
      prev: "Mois précédents",
      next: "Mois suivants"
    },
    en: {
      months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
      weekdays: ["Mo","Tu","We","Th","Fr","Sa","Su"],
      legendBusy: "Booked",
      legendFree: "Available",
      updated: "Last updated",
      empty: "Calendar coming soon — reach us on WhatsApp.",
      sample: "sample",
      prev: "Previous months",
      next: "Next months"
    }
  };
  var t = isEn ? i18n.en : i18n.fr;

  var view = new Date();
  view.setDate(1);
  var busy = new Set();
  var meta = { updated_at: null, sample: false, loaded: false, empty: false };

  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function renderMonth(year, month) {
    var first = new Date(year, month, 1);
    var startPad = (first.getDay() + 6) % 7; // Monday=0
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var html = '<div class="cal-month">';
    html += '<h3 class="cal-month-title">' + t.months[month] + " " + year + "</h3>";
    html += '<div class="cal-weekdays">' + t.weekdays.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>";
    html += '<div class="cal-grid">';
    var i;
    for (i = 0; i < startPad; i++) html += '<span class="cal-day is-pad"></span>';
    for (i = 1; i <= daysInMonth; i++) {
      var d = new Date(year, month, i);
      var key = ymd(d);
      var isBusy = busy.has(key);
      var cls = "cal-day" + (isBusy ? " is-busy" : " is-free");
      var today = ymd(new Date());
      if (key === today) cls += " is-today";
      if (key < today) cls += " is-past";
      html += '<span class="' + cls + '"' + (isBusy ? ' title="' + t.legendBusy + '"' : "") + ">" +
        (isBusy ? "<s>" + i + "</s>" : i) + "</span>";
    }
    html += "</div></div>";
    return html;
  }

  function render() {
    var grid = root.querySelector("[data-cal-grid]");
    var legend = root.querySelector("[data-cal-legend]");
    var updated = root.querySelector("[data-cal-updated]");
    var badge = root.querySelector("[data-cal-sample]");
    var empty = root.querySelector("[data-cal-empty]");
    if (!grid) return;

    if (meta.empty) {
      grid.hidden = true;
      if (legend) legend.hidden = true;
      if (empty) { empty.hidden = false; empty.textContent = t.empty; }
      return;
    }
    if (empty) empty.hidden = true;
    grid.hidden = false;
    if (legend) {
      legend.hidden = false;
      legend.innerHTML = '<span class="cal-legend-item"><i class="cal-swatch is-free"></i>' + t.legendFree +
        '</span><span class="cal-legend-item"><i class="cal-swatch is-busy"></i>' + t.legendBusy + "</span>";
    }
    var y = view.getFullYear(), m = view.getMonth();
    var next = new Date(y, m + 1, 1);
    grid.innerHTML = renderMonth(y, m) + renderMonth(next.getFullYear(), next.getMonth());
    if (updated && meta.updated_at) {
      var d = new Date(meta.updated_at);
      updated.textContent = t.updated + " : " + d.toLocaleString(isEn ? "en-GB" : "fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
    }
    if (badge) {
      badge.hidden = !meta.sample;
      badge.textContent = t.sample;
    }
  }

  root.querySelectorAll("[data-cal-nav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dir = btn.getAttribute("data-cal-nav") === "prev" ? -1 : 1;
      view.setMonth(view.getMonth() + dir * 2);
      render();
    });
  });

  var dataUrl = (location.pathname.indexOf("/en/") !== -1) ? "../data/availability.json" : "data/availability.json";
  fetch(dataUrl, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("missing"); return r.json(); })
    .then(function (data) {
      meta.loaded = true;
      meta.updated_at = data.updated_at || null;
      meta.sample = !!data.sample;
      (data.busy || []).forEach(function (d) { busy.add(d); });
      meta.empty = !(data.busy && data.busy.length);
      if (data.busy && data.busy.length) {
        meta.empty = false;
        var todayKey = ymd(new Date());
        var first = data.busy.find(function (d) { return d >= todayKey; }) || data.busy[0];
        if (first) {
          var parts = first.split("-");
          view = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        }
      }
      render();
    })
    .catch(function () {
      meta.loaded = true;
      meta.empty = true;
      render();
    });

  // Initial labels for a11y
  var prev = root.querySelector('[data-cal-nav="prev"]');
  var next = root.querySelector('[data-cal-nav="next"]');
  if (prev) prev.setAttribute("aria-label", t.prev);
  if (next) next.setAttribute("aria-label", t.next);
})();
