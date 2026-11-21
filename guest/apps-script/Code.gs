/**
 * Standalone web app. Opens the spreadsheet by id.
 * doPost logs a guest request. doGet confirms one request.
 */
var SHEET_ID = "1bd3xmrdjz7_Ae8xiu__OuxKUliQUWCvYg8i7J1ugMj8";
var ADMIN_TEST_MODE = true;
var ADMIN_ALLOWLIST = ["villazeno.marrakech@gmail.com", "jalil.moumni@gmail.com"];
var STAY_HEADERS = [
  "nom", "telephone", "source", "adultes", "enfants", "ages_enfants", "notes",
  "airbnb_frais_chambre", "airbnb_reduction", "airbnb_frais_service", "airbnb_gain",
  "booking_montant", "booking_commission", "booking_frais_bancaires", "booking_net",
  "direct_tarif", "acompte_montant", "acompte_date", "acompte_mode", "reste_a_payer",
  "offert_petit_dejeuner",
  "encaisse_total_eur", "encaisse_mode", "encaisse_le", "offerts"
];
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
    if (data.action === "save-stay" || data.action === "stay-link" || data.action === "admin-auth") {
      return adminPost_(data);
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
  if (params.action === "stays" || params.action === "stay" || params.action === "demandes" || params.action === "depenses") return adminGet_(params);
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
    if (status === "Confirm\u00e9e" || status === "Termin\u00e9e") return htmlPage_("Demande confirm\u00e9e", confirmLine_(details), true);
    sheet.getRange(row, 9).setValue("Confirm\u00e9e");
    sheet.getRange(row, 10).setValue(Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd HH:mm"));
    return htmlPage_("Demande confirm\u00e9e", confirmLine_(details), true);
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
  var empty = { arrival: "", departure: "", lien_actif: true, lien_expire_le: "", pool: null, jacuzzi: null, source: "", adults: 0, children: 0 };
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
    var actifCol = firstCol_(map, ["lien_actif"]);
    return {
      arrival: cellDate_(values[r], map, ["date_arrivee", "arrivee", "check_in", "arrival"]),
      departure: cellDate_(values[r], map, ["date_depart", "depart", "check_out", "departure"]),
      lien_actif: actifCol == null ? true : offertValue_(values[r][actifCol]),
      lien_expire_le: cellDate_(values[r], map, ["lien_expire_le"]),
      pool: heat_(values[r], map, "chauffage_piscine"),
      jacuzzi: heat_(values[r], map, "chauffage_jacuzzi"),
      source: cellText_(values[r], map, ["source"]),
      adults: cellNumber_(values[r], map, ["adultes", "adults", "nb_adultes"]),
      children: cellNumber_(values[r], map, ["enfants", "children", "nb_enfants"])
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

function cellText_(row, map, names) {
  var col = firstCol_(map, names);
  if (col == null || row[col] === "") return "";
  return String(row[col]);
}

function cellNumber_(row, map, names) {
  var col = firstCol_(map, names);
  if (col == null || row[col] === "") return 0;
  return Number(row[col]) || 0;
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

function confirmLine_(details) {
  var name = "Demande";
  if (details.meal === "breakfast") name = "Petit-d\u00e9jeuner";
  else if (details.meal === "dinner") name = "D\u00eener";
  else if (details.meal === "lunch") name = "D\u00e9jeuner";
  else if (details.activity === "quad") name = "Quad";
  else if (details.activity_label) name = String(details.activity_label);
  else if (details.meal_label) name = String(details.meal_label);
  var bits = [name];
  if (details.date) bits.push(String(details.date).slice(0, 10));
  if (details.time_label || details.time) bits.push(String(details.time_label || details.time));
  if (details.people) bits.push(String(details.people) + " pers.");
  return bits.join(" \u00b7 ");
}

function htmlPage_(message, summary, branded) {
  var summaryHtml = summary
    ? "<p style=\"margin:8px 0 0;color:#5e554c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:0.9rem;line-height:1.4;\">" + escapeHtml_(summary) + "</p>"
    : "";
  var html;
  if (branded) {
    html = "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
      + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
      + "<title>Villa Zen\u2019O</title></head>"
      + "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f1ea;color:#1c1916;font-family:Georgia,'Times New Roman',serif;\">"
      + "<main style=\"width:min(22rem,calc(100% - 2.5rem));text-align:center;\">"
      + "<p style=\"margin:0;font-size:1.35rem;\">Villa Zen\u2019O</p>"
      + "<div style=\"width:52px;height:52px;margin:24px auto 0;border-radius:50%;background:#e3f2e6;color:#1d6b3a;display:flex;align-items:center;justify-content:center;font-size:1.5rem;line-height:1;\">\u2713</div>"
      + "<h1 style=\"margin:20px 0 0;font-weight:500;font-size:1.7rem;line-height:1.25;\">" + escapeHtml_(message) + "</h1>"
      + summaryHtml
      + "<p style=\"margin:16px 0 0;font-style:italic;font-size:1.15rem;\">Merci</p>"
      + "</main></body></html>";
  } else {
    html = "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
      + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
      + "<title>Villa Zen\u2019O</title></head>"
      + "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f1ea;color:#1c1916;font-family:Georgia,'Times New Roman',serif;\">"
      + "<main style=\"width:min(22rem,calc(100% - 2.5rem));text-align:center;\">"
      + "<h1 style=\"margin:0;font-weight:500;font-size:1.7rem;line-height:1.3;\">" + escapeHtml_(message) + "</h1>"
      + summaryHtml
      + "</main></body></html>";
  }
  return HtmlService.createHtmlOutput(html).setTitle("Villa Zen\u2019O").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adminAllowed_(params) {
  if (ADMIN_TEST_MODE && String(params.test || "") === "1") return true;
  return adminEmail_(params.token || params.id_token || "") !== "";
}

function adminEmail_(token) {
  if (!token) return "";
  try {
    var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return "";
    var data = JSON.parse(res.getContentText());
    var email = String(data.email || "").toLowerCase();
    var verified = data.email_verified === true || String(data.email_verified) === "true";
    if (!verified || !email) return "";
    for (var i = 0; i < ADMIN_ALLOWLIST.length; i++) {
      if (String(ADMIN_ALLOWLIST[i]).toLowerCase() === email) return email;
    }
  } catch (err) {}
  return "";
}

function adminGet_(params) {
  if (!adminAllowed_(params)) return jsonOut({ ok: false, error: "forbidden" });
  if (params.action === "stay") return jsonOut({ ok: true, stay: adminStay_(params.id || "") });
  if (params.action === "demandes") return adminDemandes_(params);
  if (params.action === "depenses") return jsonOut({ ok: true, depenses: adminDepenses_(params.year || "") });
  return jsonOut({ ok: true, stays: adminStays_(params.year || "") });
}

function adminPost_(data) {
  if (data.action === "admin-auth") {
    var email = adminEmail_(data.token || data.id_token || "");
    return jsonOut(email ? { ok: true, email: email } : { ok: false, error: "forbidden" });
  }
  if (!adminAllowed_(data)) return jsonOut({ ok: false, error: "forbidden" });
  if (data.action === "save-stay") return saveStay_(data.stay || data);
  if (data.action === "stay-link") return stayLink_(data);
  if (data.action === "set-demande") return setDemande_(data);
  if (data.action === "save-depense") return saveDepense_(data);
  if (data.action === "delete-depense") return deleteDepense_(data);
  return jsonOut({ ok: false });
}

function adminDemandes_(params) {
  var sheet = getDemandesSheet_();
  var map = ensureDemandes_(sheet);
  var last = sheet.getLastRow();
  var items = [];
  var confirmer = 0;
  if (last >= 2) {
    var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
    var today = Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd");
    for (var i = 0; i < values.length; i++) {
      var details = {};
      try { details = JSON.parse(String(values[i][5] || "{}")); } catch (err) { details = {}; }
      var when = String(details.date || "").slice(0, 10);
      var status = canonStatus_(map.statut ? values[i][map.statut - 1] : values[i][8]);
      var offert = map.offert ? offertValue_(values[i][map.offert - 1]) : false;
      var item = {
        id: String(values[i][0] || ""),
        created: String(values[i][1] || ""),
        service: String(values[i][2] || ""),
        sous_type: String(values[i][3] || ""),
        guest: String(values[i][4] || ""),
        staff: String(values[i][7] || ""),
        total: values[i][6] === "" ? null : values[i][6],
        status: status,
        offert: offert,
        date: when,
        time: String(details.time_label || details.time || ""),
        adults: Number(details.adults || details.people || 0) || 0,
        children: Number(details.children || 0) || 0,
        meal: String(details.meal || ""),
        trip: String(details.trip_type || ""),
        token: String(details.token || ""),
        stay: String(details.booking_id || "")
      };
      if (status === "Envoy\u00e9e" && when && when >= today) confirmer += 1;
      var filter = String(params.filter || "toutes");
      if (filter === "confirmer" && !(status === "Envoy\u00e9e" && when && when >= today)) continue;
      if (filter === "aujourd" && when !== today) continue;
      items.push(item);
    }
  }
  return jsonOut({ ok: true, items: items, confirmer: confirmer });
}

function setDemande_(data) {
  var sheet = getDemandesSheet_();
  var map = ensureDemandes_(sheet);
  var row = findRow_(sheet, String(data.id || ""));
  if (!row) return jsonOut({ ok: false });
  if (data.statut && map.statut) {
    var status = canonStatus_(data.statut);
    sheet.getRange(row, map.statut).setValue(status);
    if (status === "Confirm\u00e9e" && map.date_confirmation) {
      sheet.getRange(row, map.date_confirmation).setValue(Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd HH:mm"));
    }
  }
  if (data.offert != null && map.offert) sheet.getRange(row, map.offert).setValue(data.offert === true || String(data.offert) === "true");
  return jsonOut({ ok: true });
}

function reservationsSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("R\u00e9servations");
  if (!sheet) return null;
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  var i;
  for (i = 0; i < headers.length; i++) {
    if (headers[i]) map[String(headers[i]).toLowerCase().replace(/[^a-z0-9_]/g, "")] = i + 1;
  }
  var col = 0;
  for (i = 0; i < headers.length; i++) if (headers[i]) col = i + 1;
  for (i = 0; i < STAY_HEADERS.length; i++) {
    if (map[STAY_HEADERS[i]]) continue;
    col += 1;
    sheet.getRange(1, col).setValue(STAY_HEADERS[i]).setFontWeight("bold");
    map[STAY_HEADERS[i]] = col;
  }
  if (map.offert_petit_dejeuner) {
    sheet.getRange(2, map.offert_petit_dejeuner, Math.max(sheet.getMaxRows() - 1, 20), 1).insertCheckboxes();
  }
  return { sheet: sheet, map: map };
}

function headerMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) map[String(headers[i]).toLowerCase().replace(/[^a-z0-9_]/g, "")] = i;
  }
  return map;
}

function adminStays_(year) {
  var book = reservationsSheet_();
  if (!book) return [];
  var sheet = book.sheet;
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var map = headerMap_(sheet);
  var items = [];
  for (var i = 0; i < values.length; i++) {
    var stay = stayFromRow_(values[i], map);
    if (!stay.id) continue;
    if (year && String(stay.arrival).slice(0, 4) !== String(year)) continue;
    items.push(stay);
  }
  return items;
}

function adminStay_(id) {
  var items = adminStays_("");
  for (var i = 0; i < items.length; i++) if (items[i].id === String(id)) return items[i];
  return null;
}

function stayFromRow_(row, map) {
  function col(name) { return map[name] == null ? "" : row[map[name]]; }
  function num(name) { return col(name) === "" ? 0 : Number(col(name)) || 0; }
  var idCol = firstCol_(map, ["booking_id", "id_reservation", "reservation_id", "id"]);
  var ages = String(col("ages_enfants") || "").split(",").filter(function (part) { return part !== ""; }).map(function (part) { return Number(part); });
  return {
    id: idCol == null ? "" : String(row[idCol] || ""),
    nom: String(col("nom") || ""),
    telephone: String(col("telephone") || ""),
    arrival: cellDate_(row, map, ["date_arrivee", "arrivee", "check_in", "arrival"]),
    departure: cellDate_(row, map, ["date_depart", "depart", "check_out", "departure"]),
    source: String(col("source") || ""),
    adults: num("adultes"),
    children: num("enfants"),
    ages: ages,
    notes: String(col("notes") || ""),
    room: Math.round(num("airbnb_frais_chambre") * 100),
    reduction: Math.round(num("airbnb_reduction") * 100),
    hostFee: Math.round(num("airbnb_frais_service") * 100),
    total: Math.round(num("booking_montant") * 100),
    commission: Math.round(num("booking_commission") * 100),
    bank: Math.round(num("booking_frais_bancaires") * 100),
    tarif: Math.round(num("direct_tarif") * 100),
    deposit: Math.round(num("acompte_montant") * 100),
    depositDate: cellDate_(row, map, ["acompte_date"]),
    depositMode: String(col("acompte_mode") || ""),
    breakfast: offertValue_(col("offert_petit_dejeuner")),
    poolDays: num("chauffage_piscine_jours"),
    poolRate: Math.round(num("chauffage_piscine_tarif_eur") * 100),
    poolOffert: offertValue_(col("chauffage_piscine_offert")),
    jacuzziDays: num("chauffage_jacuzzi_jours"),
    jacuzziRate: Math.round(num("chauffage_jacuzzi_tarif_eur") * 100),
    jacuzziOffert: offertValue_(col("chauffage_jacuzzi_offert")),
    encaisse_total_eur: num("encaisse_total_eur"),
    encaisse_mode: String(col("encaisse_mode") || ""),
    encaisse_le: cellDate_(row, map, ["encaisse_le"]),
    offerts: String(col("offerts") || "").split(",").filter(function (part) { return part !== ""; }),
    lien_actif: map.lien_actif == null ? true : offertValue_(row[map.lien_actif]),
    lien_expire_le: cellDate_(row, map, ["lien_expire_le"])
  };
}

function saveStay_(stay) {
  var book = reservationsSheet_();
  if (!book) return jsonOut({ ok: false, error: "sheet" });
  var sheet = book.sheet;
  var map = book.map;
  var idKey = map.booking_id ? "booking_id" : (map.id ? "id" : "booking_id");
  if (!map[idKey]) {
    var col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue("booking_id").setFontWeight("bold");
    map.booking_id = col;
    idKey = "booking_id";
  }
  var id = String(stay.booking_id || stay.id || newStayId_(sheet, map[idKey]));
  var row = findRowInColumn_(sheet, map[idKey], id);
  if (!row) {
    sheet.appendRow([""]);
    row = sheet.getLastRow();
  }
  var values = stayValues_(stay, id);
  var aliases = {
    booking_id: ["booking_id", "id_reservation", "reservation_id", "id"],
    date_arrivee: ["date_arrivee", "arrivee", "check_in", "arrival"],
    date_depart: ["date_depart", "depart", "check_out", "departure"]
  };
  var keys = Object.keys(values);
  for (var i = 0; i < keys.length; i++) {
    var names = aliases[keys[i]] || [keys[i]];
    var column = 0;
    for (var n = 0; n < names.length && !column; n++) if (map[names[n]]) column = map[names[n]];
    if (!column) continue;
    sheet.getRange(row, column).setValue(values[keys[i]]);
  }
  return jsonOut({ ok: true, id: id });
}

function stayValues_(stay, id) {
  return {
    booking_id: id,
    nom: stay.nom || "",
    telephone: stay.telephone || "",
    date_arrivee: stay.date_arrivee || stay.arrival || "",
    date_depart: stay.date_depart || stay.departure || "",
    source: stay.source || "",
    adultes: stay.adultes || stay.adults || 0,
    enfants: stay.enfants || stay.children || 0,
    ages_enfants: stay.ages_enfants || "",
    notes: stay.notes || "",
    lien_actif: stay.lien_actif !== false,
    lien_expire_le: stay.lien_expire_le || "",
    airbnb_frais_chambre: stay.airbnb_frais_chambre || "",
    airbnb_reduction: stay.airbnb_reduction || "",
    airbnb_frais_service: stay.airbnb_frais_service || "",
    airbnb_gain: stay.airbnb_gain || "",
    booking_montant: stay.booking_montant || "",
    booking_commission: stay.booking_commission || "",
    booking_frais_bancaires: stay.booking_frais_bancaires || "",
    booking_net: stay.booking_net || "",
    direct_tarif: stay.direct_tarif || "",
    acompte_montant: stay.acompte_montant || "",
    acompte_date: stay.acompte_date || "",
    acompte_mode: stay.acompte_mode || "",
    reste_a_payer: stay.reste_a_payer || "",
    offert_petit_dejeuner: !!stay.offert_petit_dejeuner,
    chauffage_piscine_jours: stay.chauffage_piscine_jours || 0,
    chauffage_piscine_tarif_eur: stay.chauffage_piscine_tarif_eur || 0,
    chauffage_piscine_offert: !!stay.chauffage_piscine_offert,
    chauffage_jacuzzi_jours: stay.chauffage_jacuzzi_jours || 0,
    chauffage_jacuzzi_tarif_eur: stay.chauffage_jacuzzi_tarif_eur || 0,
    chauffage_jacuzzi_offert: !!stay.chauffage_jacuzzi_offert,
    encaisse_total_eur: stay.encaisse_total_eur || "",
    encaisse_mode: stay.encaisse_mode || "",
    encaisse_le: stay.encaisse_le || "",
    offerts: stay.offerts || ""
  };
}

function stayLink_(data) {
  var book = reservationsSheet_();
  if (!book) return jsonOut({ ok: false, error: "sheet" });
  var map = book.map;
  var idCol = map.booking_id || map.id;
  if (!idCol) return jsonOut({ ok: false });
  var row = findRowInColumn_(book.sheet, idCol, String(data.id || ""));
  if (!row) return jsonOut({ ok: false });
  if (data.op === "deactivate" && map.lien_actif) {
    book.sheet.getRange(row, map.lien_actif).setValue(false);
    return jsonOut({ ok: true });
  }
  if (data.op === "prolong" && map.lien_expire_le) {
    var current = String(book.sheet.getRange(row, map.lien_expire_le).getValue() || "");
    var base = current ? new Date(current) : new Date();
    if (isNaN(base.getTime()) || base.getTime() < Date.now()) base = new Date();
    base.setDate(base.getDate() + 7);
    book.sheet.getRange(row, map.lien_expire_le).setValue(Utilities.formatDate(base, "Africa/Casablanca", "yyyy-MM-dd"));
    if (map.lien_actif) book.sheet.getRange(row, map.lien_actif).setValue(true);
    return jsonOut({ ok: true });
  }
  return jsonOut({ ok: false });
}

function findRowInColumn_(sheet, col, id) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var values = sheet.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) if (String(values[i][0]) === id) return i + 2;
  return 0;
}

var DEPENSE_HEADERS = ["id", "date", "categorie", "detail", "fournisseur", "montant_dh", "montant_eur", "devise_saisie", "facture_url", "cree_le"];
var EURO_DH = 10;

function depensesSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("D\u00e9penses");
  if (!sheet) {
    sheet = ss.insertSheet("D\u00e9penses");
    sheet.getRange(1, 1, 1, DEPENSE_HEADERS.length).setValues([DEPENSE_HEADERS]).setFontWeight("bold");
    return sheet;
  }
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var have = {};
  var col = 0;
  var i;
  for (i = 0; i < headers.length; i++) if (headers[i]) { have[String(headers[i])] = true; col = i + 1; }
  for (i = 0; i < DEPENSE_HEADERS.length; i++) {
    if (have[DEPENSE_HEADERS[i]]) continue;
    col += 1;
    sheet.getRange(1, col).setValue(DEPENSE_HEADERS[i]).setFontWeight("bold");
  }
  return sheet;
}

function adminDepenses_(year) {
  var sheet = depensesSheet_();
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var items = [];
  for (var i = 0; i < values.length; i++) {
    var date = cellDate_(values[i], { date: 1 }, ["date"]);
    if (!values[i][0]) continue;
    if (year && String(date).slice(0, 4) !== String(year)) continue;
    items.push({
      id: String(values[i][0] || ""),
      date: date,
      categorie: String(values[i][2] || ""),
      detail: String(values[i][3] || ""),
      fournisseur: String(values[i][4] || ""),
      montant_dh: Number(values[i][5]) || 0,
      montant_eur: Number(values[i][6]) || 0,
      devise_saisie: String(values[i][7] || ""),
      facture_url: String(values[i][8] || ""),
      cree_le: String(values[i][9] || "")
    });
  }
  return items;
}

function facturesFolder_() {
  var name = "Villa Zen\u2019O \u2013 Factures";
  var found = DriveApp.getFoldersByName(name);
  if (found.hasNext()) return found.next();
  return DriveApp.createFolder(name);
}

function saveFacture_(data) {
  var raw = String(data.facture_base64 || "");
  if (!raw) return data.depense && data.depense.facture_url ? String(data.depense.facture_url) : "";
  var parts = raw.split(",");
  var bytes = Utilities.base64Decode(parts.length > 1 ? parts[1] : parts[0]);
  var name = String(data.facture_nom || "facture.jpg");
  var file = facturesFolder_().createFile(Utilities.newBlob(bytes, "image/jpeg", name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function saveDepense_(data) {
  var sheet = depensesSheet_();
  var item = data.depense || data;
  var id = String(item.id || "");
  if (!id) id = "d" + String(new Date().getTime());
  var row = findRowInColumn_(sheet, 1, id);
  if (!row) {
    sheet.appendRow([""]);
    row = sheet.getLastRow();
  }
  var eur = Number(item.montant_eur) || 0;
  var dh = Number(item.montant_dh) || Math.round(eur * EURO_DH * 100) / 100;
  var url = saveFacture_(data) || String(item.facture_url || "");
  sheet.getRange(row, 1, 1, DEPENSE_HEADERS.length).setValues([[
    id,
    item.date || "",
    item.categorie || "",
    item.detail || "",
    item.fournisseur || "",
    dh,
    eur,
    item.devise_saisie || "",
    url,
    item.cree_le || Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd")
  ]]);
  return jsonOut({ ok: true, id: id, facture_url: url });
}

function deleteDepense_(data) {
  var sheet = depensesSheet_();
  var row = findRowInColumn_(sheet, 1, String(data.id || ""));
  if (!row) return jsonOut({ ok: false });
  var url = String(sheet.getRange(row, 9).getValue() || "");
  var match = url.match(/\/d\/([^/]+)/);
  if (match) {
    try { DriveApp.getFileById(match[1]).setTrashed(true); } catch (err) {}
  }
  sheet.deleteRow(row);
  return jsonOut({ ok: true });
}

function newStayId_(sheet, col) {
  var alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  for (var n = 0; n < 8; n++) {
    var id = "";
    for (var i = 0; i < 10; i++) id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    if (!findRowInColumn_(sheet, col, id)) return id;
  }
  return "stay" + String(Date.now()).slice(-6);
}
