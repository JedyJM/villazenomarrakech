/**
 * Standalone web app. Opens the spreadsheet by id.
 * doPost logs a guest request. doGet confirms one request.
 */
var SHEET_ID = "1bd3xmrdjz7_Ae8xiu__OuxKUliQUWCvYg8i7J1ugMj8";
var DEMANDES_HEADERS = [
  "id",
  "date_creation",
  "service",
  "sous_type",
  "nom_client",
  "details_json",
  "total_dh",
  "destinataire",
  "statut",
  "date_confirmation",
  "offert"
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var data = {};
    try {
      data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    } catch (err) {
      return jsonOut({ ok: false });
    }
    if (!data.id) return jsonOut({ ok: false });
    var sheet = getDemandesSheet_();
    if (findRow_(sheet, String(data.id)) > 0) return jsonOut({ ok: true, duplicate: true });
    var details = data.details || {};
    if (data.token && !details.token) details.token = data.token;
    ensureDemandes_(sheet);
    sheet.appendRow([
      String(data.id),
      data.date_creation || new Date().toISOString(),
      data.service || "",
      data.sous_type || "",
      data.nom_client || "",
      JSON.stringify(details),
      data.total_dh === 0 ? 0 : (data.total_dh || ""),
      data.destinataire || "",
      "Envoy\u00e9e",
      "",
      false
    ]);
    return jsonOut({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action === "list") return listDemandes_(params.stay || "");
  if (params.action !== "confirm" || !params.id || !params.t) {
    return htmlPage_("Ce lien n\u2019est pas valable.");
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = getDemandesSheet_();
    var row = findRow_(sheet, String(params.id));
    if (!row) return htmlPage_("Ce lien n\u2019est pas valable.");
    var detailsRaw = String(sheet.getRange(row, 6).getValue() || "");
    var details = {};
    try {
      details = JSON.parse(detailsRaw);
    } catch (err) {
      return htmlPage_("Ce lien n\u2019est pas valable.");
    }
    if (!details.token || String(details.token) !== String(params.t)) {
      return htmlPage_("Ce lien n\u2019est pas valable.");
    }
    var status = String(sheet.getRange(row, 9).getValue() || "");
    var summary = details.resume || "";
    if (status === "Confirm\u00e9e" || status === "Termin\u00e9e") return htmlPage_("Cette demande est d\u00e9j\u00e0 confirm\u00e9e.");
    sheet.getRange(row, 9).setValue("Confirm\u00e9e");
    sheet.getRange(row, 10).setValue(Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd HH:mm"));
    return htmlPage_("Merci, demande confirm\u00e9e");
  } finally {
    lock.releaseLock();
  }
}

function getDemandesSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Demandes");
  if (!sheet) {
    sheet = ss.insertSheet("Demandes");
  }
  if (sheet.getLastRow() === 0 || String(sheet.getRange(1, 1).getValue()) !== "id") {
    if (sheet.getLastRow() > 0 && String(sheet.getRange(1, 1).getValue()) !== "id") {
      sheet.insertRowBefore(1);
    }
    sheet.getRange(1, 1, 1, DEMANDES_HEADERS.length).setValues([DEMANDES_HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function listDemandes_(stay) {
  var sheet = getDemandesSheet_();
  var map = ensureDemandes_(sheet);
  var stayInfo = stayRecord_(stay);
  if (!stay) return jsonOut({ ok: true, items: [], stay: stayInfo });
  var last = sheet.getLastRow();
  if (last < 2) return jsonOut({ ok: true, items: [], stay: stayInfo });
  var width = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, last - 1, width).getValues();
  var items = [];
  for (var i = 0; i < values.length; i++) {
    var details = {};
    try {
      details = JSON.parse(String(values[i][5] || "{}"));
    } catch (err) {
      details = {};
    }
    if (String(details.booking_id || "") !== String(stay)) continue;
    var rawStatus = map.statut ? values[i][map.statut - 1] : values[i][8];
    var offert = map.offert ? offertValue_(values[i][map.offert - 1]) : false;
    var dish = "";
    if (details.dishes && details.dishes.length) dish = String(details.dishes[0].label || "");
    items.push({
      id: String(values[i][0] || ""),
      date_creation: String(values[i][1] || ""),
      service: String(values[i][2] || ""),
      sous_type: String(values[i][3] || ""),
      total: values[i][6] === "" ? null : values[i][6],
      unit: String(values[i][2] || "") === "restauration" ? "eur" : "dh",
      status: shownStatus_(rawStatus, details),
      offert: offert,
      when_date: details.date || "",
      when_time: details.time_label || details.time || "",
      meal: details.meal || "",
      people: details.people || "",
      supplement: details.supplement || 0,
      dish: dish,
      activity: details.activity || "",
      activity_label: details.activity_label || "",
      scope: details.scope || "",
      trip_type: details.trip_type || ""
    });
  }
  items.sort(function (a, b) {
    return String(b.date_creation).localeCompare(String(a.date_creation));
  });
  return jsonOut({ ok: true, items: items, stay: stayInfo });
}

function ensureDemandes_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), DEMANDES_HEADERS.length);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  var i;
  for (i = 0; i < headers.length; i++) {
    if (headers[i]) map[String(headers[i])] = i + 1;
  }
  if (!map.offert) {
    var col = 0;
    for (i = 0; i < headers.length; i++) if (headers[i]) col = i + 1;
    col += 1;
    sheet.getRange(1, col).setValue("offert").setFontWeight("bold");
    map.offert = col;
    var boxRows = Math.max(sheet.getMaxRows() - 1, 20);
    sheet.getRange(2, col, boxRows, 1).insertCheckboxes();
  }
  var statutCol = map.statut || 9;
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Envoy\u00e9e", "Confirm\u00e9e", "Termin\u00e9e", "Annul\u00e9e"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, statutCol, Math.max(sheet.getMaxRows() - 1, 20), 1).setDataValidation(rule);
  return map;
}

function stayRecord_(stay) {
  var empty = { arrival: "", departure: "", pool: null, jacuzzi: null };
  if (!stay) return empty;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("R\u00e9servations");
  if (!sheet || sheet.getLastRow() < 2) return empty;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var h = 0; h < headers.length; h++) {
    map[String(headers[h] || "").toLowerCase().replace(/[^a-z0-9_]/g, "")] = h;
  }
  var idCol = firstCol_(map, ["booking_id", "id_reservation", "reservation_id", "id"]);
  if (idCol == null) return empty;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][idCol]) !== String(stay)) continue;
    return {
      arrival: cellDate_(values[r], map, ["date_arrivee", "arrivee", "check_in", "arrival"]),
      departure: cellDate_(values[r], map, ["date_depart", "depart", "check_out", "departure"]),
      pool: heat_(values[r], map, "chauffage_piscine"),
      jacuzzi: heat_(values[r], map, "chauffage_jacuzzi")
    };
  }
  return empty;
}

function firstCol_(map, names) {
  for (var i = 0; i < names.length; i++) if (map[names[i]] != null) return map[names[i]];
  return null;
}

function cellDate_(row, map, names) {
  var col = firstCol_(map, names);
  if (col == null || row[col] === "") return "";
  var value = row[col];
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Africa/Casablanca", "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function heat_(row, map, prefix) {
  var daysCol = map[prefix + "_jours"];
  var rateCol = map[prefix + "_tarif_eur"];
  var offertCol = map[prefix + "_offert"];
  if (daysCol == null || rateCol == null) return null;
  return {
    days: Number(row[daysCol]) || 0,
    rate: Number(row[rateCol]) || 0,
    offert: offertCol == null ? false : offertValue_(row[offertCol])
  };
}

function offertValue_(value) {
  var text = String(value || "").toLowerCase();
  return value === true || text === "true" || text === "oui" || text === "1" || text === "x";
}

function shownStatus_(raw, details) {
  var status = canonStatus_(raw);
  if (status !== "Confirm\u00e9e") return status;
  if (pastGrace_(details.date, details.time_label || details.time)) return "Termin\u00e9e";
  return status;
}

function canonStatus_(value) {
  var s = String(value || "").toLowerCase();
  if (s === "confirm\u00e9e" || s === "confirmee") return "Confirm\u00e9e";
  if (s === "termin\u00e9e" || s === "terminee") return "Termin\u00e9e";
  if (s === "annul\u00e9e" || s === "annulee") return "Annul\u00e9e";
  return "Envoy\u00e9e";
}

function pastGrace_(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(date || ""))) return false;
  var match = String(time || "").match(/(\d{1,2})(?:\s*[:hH]\s*(\d{2}))?/);
  var hour = match ? Number(match[1]) : 0;
  var minute = match && match[2] ? Number(match[2]) : 0;
  var parts = String(date).slice(0, 10).split("-");
  var when = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hour, minute, 0, 0);
  return Date.now() >= when.getTime() + 2 * 60 * 60 * 1000;
}

function markDemandesTerminees() {
  var sheet = getDemandesSheet_();
  var map = ensureDemandes_(sheet);
  var last = sheet.getLastRow();
  if (last < 2 || !map.statut) return;
  var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (canonStatus_(values[i][map.statut - 1]) !== "Confirm\u00e9e") continue;
    var details = {};
    try { details = JSON.parse(String(values[i][5] || "{}")); } catch (err) { details = {}; }
    if (pastGrace_(details.date, details.time_label || details.time)) {
      sheet.getRange(i + 2, map.statut).setValue("Termin\u00e9e");
    }
  }
}

function installDemandesTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "markDemandesTerminees") return;
  }
  ScriptApp.newTrigger("markDemandesTerminees").timeBased().everyHours(1).create();
}

function shortDetail_(details, sousType) {
  var resume = String(details.resume || "");
  var lines = resume.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line || line.indexOf("Repas :") === 0 || line.indexOf("Date :") === 0 || line.indexOf("Heure :") === 0) continue;
    var parts = line.split(" : ");
    if (parts.length > 1 && parts[0] !== "Total" && parts[0] !== "Nom") return parts[0] + " · " + parts.slice(1).join(" : ");
  }
  return sousType || "";
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function htmlPage_(message, summary) {
  var summaryHtml = summary
    ? "<p style=\"margin:1.4rem 0 0;color:#5e554c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:0.78rem;line-height:1.55;white-space:pre-line;text-align:left;\">" + escapeHtml_(summary) + "</p>"
    : "";
  var html = "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    + "<title>Villa Zen\u2019O</title></head>"
    + "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f1ea;color:#1c1916;font-family:Georgia,'Times New Roman',serif;\">"
    + "<main style=\"width:min(22rem,calc(100% - 2.5rem));text-align:center;padding:2.5rem 0;\">"
    + "<h1 style=\"margin:0;font-weight:500;font-size:1.85rem;line-height:1.3;\">" + escapeHtml_(message) + "</h1>"
    + summaryHtml
    + "</main></body></html>";
  return HtmlService.createHtmlOutput(html).setTitle("Villa Zen\u2019O").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
