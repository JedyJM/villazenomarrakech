/* Amounts for the admin Séjours tab. Cents are integers. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AdminCalc = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var TAX_CENTS = 250;
  var EURO_DH = 10;

  function cents(value) {
    if (typeof value === "number" && isFinite(value)) return Math.round(value * 100);
    var text = String(value == null ? "" : value).replace(/\s|\u00A0/g, "").replace(",", ".").replace("−", "-");
    if (!text || text === "-" || text === "−") return 0;
    var n = Number(text);
    return isFinite(n) ? Math.round(n * 100) : 0;
  }

  function money(amountCents, withSign) {
    var n = Math.round(Number(amountCents) || 0);
    var neg = n < 0;
    n = Math.abs(n);
    var whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    var frac = String(n % 100);
    if (frac.length < 2) frac = "0" + frac;
    return (neg ? "−" : (withSign && amountCents > 0 ? "+" : "")) + whole + "," + frac + "\u00A0€";
  }

  function dirhams(amountCents) {
    var n = Math.round(Number(amountCents) || 0) * EURO_DH;
    var neg = n < 0;
    n = Math.abs(n);
    var whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    var frac = n % 100;
    var text = whole;
    if (frac) text += "," + (frac < 10 ? "0" : "") + frac;
    return (neg ? "−" : "") + text + "\u00A0DH";
  }

  function isoParts(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  function utcDay(iso) {
    var p = isoParts(iso);
    if (!p) return null;
    return Date.UTC(p.y, p.m - 1, p.d);
  }

  function nights(arrival, departure) {
    var a = utcDay(arrival);
    var b = utcDay(departure);
    if (a == null || b == null) return 0;
    return Math.round((b - a) / 86400000);
  }

  function addDays(iso, days) {
    var t = utcDay(iso);
    if (t == null) return "";
    var d = new Date(t + days * 86400000);
    var m = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    return d.getUTCFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function dayText(iso, withYear) {
    var p = isoParts(iso);
    if (!p) return "";
    var text = p.d + "\u00A0" + MONTHS[p.m - 1];
    if (withYear) text += "\u00A0" + p.y;
    return text;
  }

  function rangeLabel(arrival, departure) {
    var a = isoParts(arrival);
    var b = isoParts(departure);
    if (!a || !b) return "";
    if (a.y === b.y && a.m === b.m) return a.d + "–" + b.d + "\u00A0" + MONTHS[a.m - 1];
    return dayText(arrival, false) + " – " + dayText(departure, a.y !== b.y);
  }

  function statusOf(arrival, departure, todayIso) {
    var a = utcDay(arrival);
    var b = utcDay(departure);
    var t = utcDay(todayIso);
    if (a == null || b == null || t == null) return "venir";
    if (t >= b) return "fini";
    if (t < a) return "venir";
    return "cours";
  }

  function airbnbGain(roomCents, reductionCents, feeCents) {
    return (roomCents || 0) - (reductionCents || 0) - (feeCents || 0);
  }

  function bookingNet(totalCents, commissionCents, bankCents) {
    return (totalCents || 0) - (commissionCents || 0) - (bankCents || 0);
  }

  function bookingTax(people, nightCount) {
    var p = Number(people) || 0;
    var n = Number(nightCount) || 0;
    if (p < 1 || n < 1) return 0;
    return p * n * TAX_CENTS;
  }

  function directDue(totalCents, depositCents) {
    return (totalCents || 0) - (depositCents || 0);
  }

  function newId() {
    var alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    var id = "";
    for (var i = 0; i < 10; i++) id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return id;
  }

  return {
    TAX_CENTS: TAX_CENTS,
    cents: cents,
    money: money,
    dirhams: dirhams,
    nights: nights,
    addDays: addDays,
    dayText: dayText,
    rangeLabel: rangeLabel,
    statusOf: statusOf,
    airbnbGain: airbnbGain,
    bookingNet: bookingNet,
    bookingTax: bookingTax,
    directDue: directDue,
    newId: newId,
    todayIso: function () {
      var d = new Date();
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
    }
  };
});
