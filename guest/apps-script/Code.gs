/**
 * Standalone web app. Opens the spreadsheet by id.
 * doPost logs a guest request. doGet confirms one request.
 */
var SHEET_ID = "1bd3xmrdjz7_Ae8xiu__OuxKUliQUWCvYg8i7J1ugMj8";
var ADMIN_TEST_MODE = true;
// Fallback until the Script Property ADMIN_EMAILS (comma-separated) is set.
var ADMIN_ALLOWLIST = ["jalil.moumni@gmail.com", "villazeno.marrakech@gmail.com"];
// Public OAuth web client ID used by the admin front-end (GIS). Token aud must match.
var ADMIN_OAUTH_CLIENT_ID = "971461193352-3kafun281dtmvorv1tpp2j7n9l2g8klf.apps.googleusercontent.com";
var STAY_HEADERS = [
  "nom", "telephone", "source", "agence_nom", "adultes", "enfants", "ages_enfants", "notes",
  "airbnb_frais_chambre", "airbnb_reduction", "airbnb_frais_service", "airbnb_gain",
  "booking_montant", "booking_commission", "booking_frais_bancaires", "booking_net",
  "direct_tarif", "acompte_montant", "acompte_date", "acompte_mode", "reste_a_payer",
  "offert_petit_dejeuner",
  "encaisse_total_eur", "encaisse_mode", "encaisse_le", "offerts", "bien"
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

// WhatsApp Cloud API sending. The token lives in Script properties (WHATSAPP_TOKEN).
// Recipients are chosen on the server by service, never from client data.
var WA_PHONE_NUMBER_ID = "1349306241609019";
var WA_GRAPH = "https://graph.facebook.com/v21.0/";
var WA_TEMPLATE = "nouvelle_demande";
var WA_LANG = "ar_MA";
var WA_TEST_TO = "33614675789"; // Jedy
var WA_STAFF = {
  restauration: "212767202011", // Fouzia
  menage: "212639474843", // Nadera
  piscine: "212630415956", // Khalid
  activites: "212630415956" // Khalid
};
var WA_SERVICE_AR = {
  restauration: "المطعم",
  menage: "التنظيف",
  piscine: "المسبح والجاكوزي والحديقة",
  activites: "الأنشطة"
};

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
    if (data.action === "save-stay" || data.action === "stay-link" || data.action === "admin-auth" || data.action === "set-demande" || data.action === "save-depense" || data.action === "delete-depense" || data.action === "save-reglages") {
      return adminPost_(data);
    }
    // WhatsApp Cloud API events relayed by the Vercel function api/wa-webhook.js.
    if (data.action === "wa-webhook") {
      var counts = waWebhook_(data.payload || {});
      return jsonOut({ ok: true, statuts: counts.statuts, messages: counts.messages, confirmees: counts.confirmees });
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
    notifyNewDemande_(data);
    waNotifyStaff_(data);
    return jsonOut({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action === "list") return listDemandes_(params.stay || "");
  if (params.action === "stays" || params.action === "stays-stats" || params.action === "stay" || params.action === "demandes" || params.action === "depenses" || params.action === "get-reglages") return adminGet_(params);
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
      supplement: details.supplement || details.supplement_dh || 0,
      bill: details.bill_label || "",
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
    if (!rowIsZeno_(values[r], map)) return empty;
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

// True when a bien value is Villa Zen'O (empty = legacy Zen'O row).
function bienIsZeno_(value) {
  var b = String(value == null ? "" : value).trim();
  return b === "" || impIsZenoText_(b);
}

// Row guard for the Zen'O-only tabs (0-based header map): false when the
// row's bien column names another property.
function rowIsZeno_(row, map) {
  return map.bien == null || bienIsZeno_(row[map.bien]);
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

// Script Property ADMIN_EMAILS (comma-separated, case-insensitive), else ADMIN_ALLOWLIST.
function adminEmails_() {
  var raw = "";
  try { raw = String(PropertiesService.getScriptProperties().getProperty("ADMIN_EMAILS") || ""); } catch (err) {}
  var list = raw ? raw.split(",") : ADMIN_ALLOWLIST;
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var email = String(list[i] || "").replace(/^\s+|\s+$/g, "").toLowerCase();
    if (email) out.push(email);
  }
  return out;
}

// Verifies a Google ID token with tokeninfo: HTTP 200, our aud, verified email, allowlisted.
// Returns { email: "...", error: "" } or { email: "", error: "invalid_token" | "unauthorized" }.
function adminCheck_(token) {
  if (!token || !ADMIN_OAUTH_CLIENT_ID) return { email: "", error: "invalid_token" };
  try {
    var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { email: "", error: "invalid_token" };
    var data = JSON.parse(res.getContentText());
    if (String(data.aud || "") !== ADMIN_OAUTH_CLIENT_ID) return { email: "", error: "invalid_token" };
    var iss = String(data.iss || "");
    if (iss && iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return { email: "", error: "invalid_token" };
    var email = String(data.email || "").toLowerCase();
    var verified = data.email_verified === true || String(data.email_verified) === "true";
    if (!verified || !email) return { email: "", error: "unauthorized" };
    var allowed = adminEmails_();
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === email) return { email: email, error: "" };
    }
    return { email: "", error: "unauthorized" };
  } catch (err) {}
  return { email: "", error: "invalid_token" };
}

function adminEmail_(token) {
  return adminCheck_(token).email;
}

function adminGet_(params) {
  if (!adminAllowed_(params)) return jsonOut({ ok: false, error: "forbidden" });
  if (params.action === "stay") return jsonOut({ ok: true, stay: adminStay_(params.id || "") });
  if (params.action === "demandes") return adminDemandes_(params);
  if (params.action === "depenses") return jsonOut({ ok: true, depenses: adminDepenses_(params.year || "") });
  if (params.action === "get-reglages") return jsonOut({ ok: true, reglages: readReglages_() });
  if (params.action === "stays-stats") return jsonOut({ ok: true, stays: adminStatsStays_() });
  return jsonOut({ ok: true, stays: adminStays_(params.year || "") });
}

function adminPost_(data) {
  if (data.action === "admin-auth") {
    var check = adminCheck_(data.id_token || data.token || "");
    return jsonOut(check.email ? { ok: true, email: check.email } : { ok: false, error: check.error || "forbidden" });
  }
  if (!adminAllowed_(data)) return jsonOut({ ok: false, error: "forbidden" });
  if (data.action === "save-stay") return saveStay_(data.stay || data);
  if (data.action === "stay-link") return stayLink_(data);
  if (data.action === "set-demande") return setDemande_(data);
  if (data.action === "save-depense") return saveDepense_(data);
  if (data.action === "delete-depense") return deleteDepense_(data);
  if (data.action === "save-reglages") return saveReglages_(data.reglages || data);
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
    if (!stay.id || !stay.portal) continue;
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

// Stats feed (action=stays-stats): Villa Zen'O stays (portal: true) plus
// the stats-only rows of "Réservations autres biens" (portal: false, no
// id, no guest data). Amounts in cents: brut, frais, net. Never used by
// Séjours, Demandes, Aujourd'hui or the portal.
function adminStatsStays_() {
  var items = adminStays_("");
  var tab = SpreadsheetApp.openById(SHEET_ID).getSheetByName(IMPORT_OTHER_TAB);
  if (!tab || tab.getLastRow() < 2) return items;
  var map = headerMap_(tab);
  var values = tab.getRange(2, 1, tab.getLastRow() - 1, tab.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var item = otherStatsFromRow_(values[i], map);
    if (item) items.push(item);
  }
  return items;
}

function otherStatsFromRow_(row, map) {
  function col(name) { return map[name] == null ? "" : row[map[name]]; }
  function cents(name) { return col(name) === "" ? null : Math.round((Number(col(name)) || 0) * 100); }
  var bien = String(col("bien") || "");
  if (!bien || bienIsZeno_(bien)) return null; // Zen'O lives in Réservations only
  var arrival = cellDate_(row, map, ["date_arrivee"]);
  if (!arrival && !col("booking_id")) return null;
  return {
    bien: bien,
    portal: false,
    source: String(col("source") || ""),
    statut: String(col("statut") || ""),
    arrival: arrival,
    departure: cellDate_(row, map, ["date_depart"]),
    guests: Number(col("voyageurs")) || 0,
    brut: cents("brut"),
    frais: cents("frais"),
    net: cents("net"),
    devise: String(col("devise") || ""),
    a_completer: String(col("a_completer") || "")
  };
}

function stayFromRow_(row, map) {
  function col(name) { return map[name] == null ? "" : row[map[name]]; }
  function num(name) { return col(name) === "" ? 0 : Number(col(name)) || 0; }
  var idCol = firstCol_(map, ["booking_id", "id_reservation", "reservation_id", "id"]);
  var ages = String(col("ages_enfants") || "").split(",").filter(function (part) { return part !== ""; }).map(function (part) { return Number(part); });
  return {
    id: idCol == null ? "" : String(row[idCol] || ""),
    bien: IMPORT_ZENO,
    portal: rowIsZeno_(row, map),
    statut: String(col("statut") || ""),
    nom: String(col("nom") || ""),
    telephone: String(col("telephone") || ""),
    arrival: cellDate_(row, map, ["date_arrivee", "arrivee", "check_in", "arrival"]),
    departure: cellDate_(row, map, ["date_depart", "depart", "check_out", "departure"]),
    source: String(col("source") || ""),
    devise: String(col("devise") || ""),
    agency: String(col("agence_nom") || ""),
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
  if (row && map.bien && !bienIsZeno_(sheet.getRange(row, map.bien).getValue())) return jsonOut({ ok: false, error: "bien" });
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
    bien: IMPORT_ZENO,
    nom: stay.nom || "",
    telephone: stay.telephone || "",
    date_arrivee: stay.date_arrivee || stay.arrival || "",
    date_depart: stay.date_depart || stay.departure || "",
    source: stay.source || "",
    agence_nom: stay.agence_nom || "",
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
  if (map.bien && !bienIsZeno_(book.sheet.getRange(row, map.bien).getValue())) return jsonOut({ ok: false, error: "bien" });
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

var REGLAGES_HEADERS = ["cle", "valeur"];
var DEFAULT_NOTIF_EMAIL = "mehdimoumni@hotmail.com";

function reglagesSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("R\u00e9glages");
  if (!sheet) {
    sheet = ss.insertSheet("R\u00e9glages");
    sheet.getRange(1, 1, 1, 2).setValues([REGLAGES_HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, 3, 2).setValues([
      ["notif_email_on", true],
      ["notif_email_to", DEFAULT_NOTIF_EMAIL],
      ["recap_8h_on", true]
    ]);
  }
  return sheet;
}

function readReglages_() {
  var sheet = reglagesSheet_();
  var res = { notif_email_on: true, notif_email_to: DEFAULT_NOTIF_EMAIL, recap_8h_on: true };
  var last = sheet.getLastRow();
  if (last < 2) return res;
  var values = sheet.getRange(2, 1, last - 1, 2).getValues();
  var i;
  for (i = 0; i < values.length; i++) {
    var key = String(values[i][0] || "");
    if (key === "notif_email_on") res.notif_email_on = values[i][1] === true || String(values[i][1]) === "true";
    if (key === "notif_email_to" && values[i][1]) res.notif_email_to = String(values[i][1]);
    if (key === "recap_8h_on") res.recap_8h_on = values[i][1] === true || String(values[i][1]) === "true";
  }
  return res;
}

function saveReglages_(data) {
  var sheet = reglagesSheet_();
  var last = Math.max(sheet.getLastRow(), 1);
  var values = sheet.getRange(1, 1, last, 2).getValues();
  var rows = { notif_email_on: 0, notif_email_to: 0, recap_8h_on: 0 };
  var i;
  for (i = 1; i < values.length; i++) {
    var key = String(values[i][0] || "");
    if (rows[key] != null) rows[key] = i + 1;
  }
  function put(key, value) {
    var row = rows[key];
    if (!row) {
      row = sheet.getLastRow() + 1;
      sheet.getRange(row, 1).setValue(key);
    }
    sheet.getRange(row, 2).setValue(value);
  }
  if (data.notif_email_on != null) put("notif_email_on", data.notif_email_on === true || String(data.notif_email_on) === "true");
  if (data.notif_email_to != null) {
    var mail = String(data.notif_email_to || "").replace(/\s/g, "");
    if (mail.indexOf("@") > 0) put("notif_email_to", mail);
  }
  if (data.recap_8h_on != null) put("recap_8h_on", data.recap_8h_on === true || String(data.recap_8h_on) === "true");
  return jsonOut({ ok: true, reglages: readReglages_() });
}

function notifyNewDemande_(data) {
  try {
    if (ADMIN_TEST_MODE) return;
    var reg = readReglages_();
    if (!reg.notif_email_on) return;
    var to = String(reg.notif_email_to || "");
    if (to.indexOf("@") < 1) return;
    var details = data.details || {};
    var when = details.date ? String(details.date) : "";
    var time = details.time_label || details.time || "";
    var lines = [
      "Nouvelle demande enregistr\u00e9e.",
      "",
      "Invit\u00e9\u00A0: " + (data.nom_client || "\u2014"),
      "Service\u00A0: " + (data.service || "\u2014"),
      "D\u00e9tail\u00A0: " + (data.sous_type || "\u2014")
    ];
    if (when) lines.push("Date\u00A0: " + when + (time ? " \u00b7 " + time : ""));
    if (data.total_dh === 0 || data.total_dh) lines.push("Total\u00A0: " + data.total_dh + "\u00A0DH");
    lines.push("", "Villa Zen\u2019O");
    MailApp.sendEmail(to, "Nouvelle demande \u00b7 Villa Zen\u2019O", lines.join("\n"));
  } catch (err) {}
}

function recapLines_(title, rows) {
  var out = [title];
  if (!rows.length) out.push("\u2014 aucun");
  else {
    var i;
    for (i = 0; i < rows.length; i++) out.push("\u00b7 " + rows[i]);
  }
  out.push("");
  return out;
}

function sendDailyRecap_() {
  try {
    if (ADMIN_TEST_MODE) return;
    var reg = readReglages_();
    if (!reg.recap_8h_on) return;
    var to = String(reg.notif_email_to || "");
    if (to.indexOf("@") < 1) return;
    var today = Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd");
    var alerts = [];
    var services = [];
    var sheet = getDemandesSheet_();
    var map = ensureDemandes_(sheet);
    var last = sheet.getLastRow();
    if (last >= 2) {
      var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
      var i;
      for (i = 0; i < values.length; i++) {
        var details = {};
        try { details = JSON.parse(String(values[i][5] || "{}")); } catch (err) { details = {}; }
        var when = String(details.date || "").slice(0, 10);
        var status = canonStatus_(map.statut ? values[i][map.statut - 1] : values[i][8]);
        var label = String(values[i][2] || "Demande") + (values[i][3] ? " \u00b7 " + values[i][3] : "");
        var guest = String(values[i][4] || "");
        var time = String(details.time_label || details.time || "");
        var line = label + (guest ? " \u00b7 " + guest : "") + (time ? " \u00b7 " + time : "");
        if (status === "Envoy\u00e9e" && when && when >= today) alerts.push(line + " \u00b7 " + when);
        if (when === today && status !== "Annul\u00e9e") services.push((time ? time + " \u00b7 " : "") + line);
      }
    }
    var arrivals = [];
    var departures = [];
    var stays = adminStays_("");
    for (var s = 0; s < stays.length; s++) {
      var stay = stays[s];
      if (String(stay.arrival) === today) arrivals.push((stay.nom || "S\u00e9jour") + (stay.source ? " \u00b7 " + stay.source : ""));
      if (String(stay.departure) === today) departures.push((stay.nom || "S\u00e9jour") + (stay.source ? " \u00b7 " + stay.source : ""));
    }
    var body = ["R\u00e9capitulatif du matin", today, ""];
    body = body.concat(recapLines_("Alertes en cours", alerts));
    body = body.concat(recapLines_("Services du jour", services));
    body = body.concat(recapLines_("Arriv\u00e9es", arrivals));
    body = body.concat(recapLines_("D\u00e9parts", departures));
    body.push("Villa Zen\u2019O");
    MailApp.sendEmail(to, "R\u00e9capitulatif \u00b7 Villa Zen\u2019O", body.join("\n"));
  } catch (err) {}
}

function installRecapTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendDailyRecap_") return;
  }
  ScriptApp.newTrigger("sendDailyRecap_").timeBased().everyDays(1).atHour(8).inTimezone("Africa/Casablanca").create();
}

// ---------- WhatsApp Cloud API webhook ----------
// Events arrive from the Vercel relay api/wa-webhook.js (action "wa-webhook").
// Every event is written to the "WhatsApp_log" tab. Meta retries, so rows are deduped.

var WA_LOG_HEADERS = [
  "recu_le", "type", "wamid", "statut", "destinataire",
  "erreur_code", "erreur_titre", "erreur_detail",
  "contexte_wamid", "bouton_texte", "bouton_payload", "demande_id", "resultat"
];

// Opens the WhatsApp_log tab, creating it with bold frozen headers if missing.
function whatsappLogSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("WhatsApp_log");
  if (!sheet) sheet = ss.insertSheet("WhatsApp_log");
  if (sheet.getLastRow() === 0 || String(sheet.getRange(1, 1).getValue()) !== "recu_le") {
    if (sheet.getLastRow() > 0) sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, WA_LOG_HEADERS.length).setValues([WA_LOG_HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Reads all log rows (without header) so we can dedupe and find earlier sends.
function waLogRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, WA_LOG_HEADERS.length).getValues();
}

// Appends one row as plain text (keeps phone numbers and ids intact) and
// remembers it in the in-memory list so later items in the same call see it.
function waAppend_(sheet, rows, values) {
  var row = sheet.getLastRow() + 1;
  var line = [];
  for (var i = 0; i < WA_LOG_HEADERS.length; i++) {
    line.push(values[i] == null ? "" : String(values[i]));
  }
  sheet.getRange(row, 1, 1, line.length).setNumberFormat("@").setValues([line]);
  rows.push(line);
}

// True if a row with this type + wamid (+ statut when given) already exists.
function waSeen_(rows, type, wamid, statut) {
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) !== type || String(rows[i][2]) !== wamid) continue;
    if (statut == null || String(rows[i][3]) === statut) return true;
  }
  return false;
}

// Finds the earlier "envoi" row (with a demande id) for this message id, or null.
function waEnvoiRow_(rows, wamid) {
  if (!wamid) return null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) === "envoi" && String(rows[i][2]) === wamid && String(rows[i][11])) {
      return rows[i];
    }
  }
  return null;
}

// Digits only, so "+212 6..." and "2126..." compare equal.
function waDigits_(value) {
  return String(value || "").replace(/\D/g, "");
}

// Confirms a demande after a button press. Returns the text for "resultat".
function waConfirmDemande_(demandeId) {
  var sheet = getDemandesSheet_();
  var row = findRow_(sheet, demandeId);
  if (!row) return "demande introuvable";
  var status = canonStatus_(sheet.getRange(row, 9).getValue());
  if (status === "Confirmée" || status === "Terminée" || status === "Annulée") {
    return "déjà " + status.toLowerCase();
  }
  sheet.getRange(row, 9).setValue("Confirmée");
  sheet.getRange(row, 10).setValue(Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd HH:mm"));
  return "confirmée";
}

// Handles one Meta webhook payload. Returns counts of new rows written.
function waWebhook_(payload) {
  var counts = { statuts: 0, messages: 0, confirmees: 0 };
  var sheet = whatsappLogSheet_();
  var rows = waLogRows_(sheet);
  var now = Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd HH:mm:ss");
  var entries = (payload && payload.entry) || [];
  for (var e = 0; e < entries.length; e++) {
    var changes = (entries[e] && entries[e].changes) || [];
    for (var c = 0; c < changes.length; c++) {
      var value = (changes[c] && changes[c].value) || {};

      // Delivery statuses: sent / delivered / read / failed.
      var statuses = value.statuses || [];
      for (var s = 0; s < statuses.length; s++) {
        var st = statuses[s] || {};
        var wamid = String(st.id || "");
        var statut = String(st.status || "");
        if (waSeen_(rows, "statut", wamid, statut)) continue;
        var err = (st.errors && st.errors[0]) || null;
        waAppend_(sheet, rows, [
          now, "statut", wamid, statut, st.recipient_id || "",
          err ? err.code : "",
          err ? err.title : "",
          err ? ((err.error_data && err.error_data.details) || err.message || "") : "",
          "", "", "", "", ""
        ]);
        counts.statuts += 1;
      }

      // Incoming messages: button replies or free messages from the staff.
      var messages = value.messages || [];
      for (var m = 0; m < messages.length; m++) {
        var msg = messages[m] || {};
        var msgId = String(msg.id || "");
        var type = "message";
        var texte = (msg.text && msg.text.body) || msg.type || "";
        var buttonPayload = "";
        if (msg.type === "button" && msg.button) {
          type = "bouton";
          texte = msg.button.text || "";
          buttonPayload = msg.button.payload || "";
        } else if (msg.type === "interactive" && msg.interactive && msg.interactive.button_reply) {
          type = "bouton";
          texte = msg.interactive.button_reply.title || "";
          buttonPayload = msg.interactive.button_reply.id || "";
        }
        if (waSeen_(rows, type, msgId, null)) continue;
        var contexte = String((msg.context && msg.context.id) || "");
        var demandeId = "";
        var resultat = "";
        if (type === "bouton") {
          // Only trust a send we logged ourselves, never the button payload alone.
          var envoi = waEnvoiRow_(rows, contexte);
          if (envoi) {
            demandeId = String(envoi[11]);
            // The reply must come from the number we sent to (column 5).
            if (!waDigits_(msg.from) || waDigits_(msg.from) !== waDigits_(envoi[4])) {
              resultat = "numéro différent";
            } else {
              resultat = waConfirmDemande_(demandeId);
              if (resultat === "confirmée") counts.confirmees += 1;
            }
          } else {
            resultat = "non reliée (aucun envoi connu)";
          }
        }
        waAppend_(sheet, rows, [
          now, type, msgId, "", msg.from || "",
          "", "", "",
          contexte, texte, buttonPayload, demandeId, resultat
        ]);
        counts.messages += 1;
      }
    }
  }
  return counts;
}

// Called right after Meta accepts a message: links the returned wamid to a
// demande so a later button press can confirm it. Optional "extra"
// { statut, code, titre, resultat } records a failed or skipped send instead.
function logWhatsAppEnvoi_(wamid, demandeId, destinataire, extra) {
  extra = extra || {};
  var sheet = whatsappLogSheet_();
  var now = Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd HH:mm:ss");
  waAppend_(sheet, [], [
    now, "envoi", wamid || "", extra.statut || "accepted", destinataire || "",
    extra.code || "", extra.titre || "", "", "", "", "", demandeId || "", extra.resultat || ""
  ]);
}

// ---------- WhatsApp Cloud API sending ----------

// Hard rule: while ADMIN_TEST_MODE is on, only the test number ever receives.
function waRecipient_(service) {
  if (ADMIN_TEST_MODE) return WA_TEST_TO;
  return WA_STAFF[service] || "";
}

function waToken_() {
  return PropertiesService.getScriptProperties().getProperty("WHATSAPP_TOKEN") || "";
}

// Separator between top-level fields of a template parameter (U+2B25).
// Meta forbids newlines in body parameters.
var WA_SEP = " \u2B25 ";

// Makes a value safe for a template body parameter (newline -> WA_SEP,
// no tabs, no runs of spaces, max 900 chars, never empty).
function waClean_(value) {
  var text = String(value == null ? "" : value)
    .replace(/\s*\r?\n\s*/g, WA_SEP)
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 900)
    .replace(/\s+$/, "");
  return text || "—";
}

// French labels (accent-free, lower case keys) to Arabic for the staff body.
var WA_LABELS_AR = {
  "personnes": "أشخاص",
  "repas": "الوجبة",
  "perimetre": "النطاق",
  "entretien": "الصيانة",
  "note": "ملاحظة",
  "allergies ou demandes": "الحساسية أو الطلبات",
  "salades": "السلطات",
  "activite": "النشاط",
  "duree": "المدة",
  "depart": "الانطلاق",
  "oeufs": "البيض",
  "adultes": "الكبار",
  "enfants": "الأطفال",
  "enfants 12 ans et plus": "أطفال 12 سنة فأكثر",
  "enfants 4 a 11 ans": "أطفال من 4 إلى 11 سنة",
  "enfants moins de 4 ans": "أطفال أقل من 4 سنوات"
};

// Whole French values translated for staff (accent-free, lower case keys).
var WA_VALUES_AR = {
  "petit-dejeuner": "الفطور",
  "dejeuner": "الغداء",
  "diner": "العشاء",
  "dur": "مسلوق",
  "brouille": "مخفوق",
  "au plat": "مقلي"
};

// Breakfast with no egg ("Œufs : aucun").
var WA_NO_EGGS_AR = "بدون بيض";

// Menu items (guest/restauration.html data-label / data-salad) to Arabic.
// Keep in sync with the menu: an unknown dish is left as written.
var WA_MENU_AR = {
  "tomates & oignons": "سلطة الطماطم والبصل",
  "caviar d'aubergine": "زعلوك الباذنجان",
  "salade de lentilles": "سلطة العدس",
  "tajine poulet aux olives": "طاجين الدجاج بالزيتون",
  "tajine de poulet aux legumes": "طاجين الدجاج بالخضر",
  "brochettes de poulet au barbecue": "قطبان الدجاج المشوية",
  "couscous au poulet et aux legumes": "كسكس بالدجاج والخضر",
  "tajine d'agneau aux pruneaux": "طاجين لحم الغنم بالبرقوق",
  "tajine d'agneau aux legumes": "طاجين لحم الغنم بالخضر",
  "barbecue mixte (kefta, agneau, poulet)": "مشوي مشكل (كفتة، لحم الغنم، دجاج)",
  "couscous a l'agneau et aux legumes": "كسكس بلحم الغنم والخضر",
  "tajine vegetarien": "طاجين نباتي",
  "couscous vegetarien": "كسكس نباتي"
};

// Meal kinds sent by the portal for restauration.
var WA_SOUS_TYPE_AR = { breakfast: "الفطور", lunch: "الغداء", dinner: "العشاء" };

// Labels whose line carries money: staff must never see a price.
var WA_MONEY_LABELS = { total: 1, supplement: 1, prix: 1, tarif: 1, montant: 1 };

// Guest-typed values are kept as written.
var WA_FREE_TEXT = { "allergies ou demandes": 1, note: 1 };

// First-strong isolate so LTR digits keep their order inside Arabic RTL text.
var WA_FSI = "\u2068";
var WA_PDI = "\u2069";

function waTrim_(value) {
  return String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
}

// Lower case, accents removed, single spaces: used as lookup key.
function waKey_(value) {
  return waTrim_(value).toLowerCase()
    .replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e").replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u").replace(/ç/g, "c")
    .replace(/œ/g, "oe").replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ");
}

function waIsolate_(value) {
  return WA_FSI + value + WA_PDI;
}

// True when a text fragment carries an amount or a currency.
function waHasMoney_(text) {
  return /€|\b(eur|euros?|dhs?|mad)\b|\d\s*(eur|dhs?|mad)\b/i.test(String(text));
}

// Removes every money segment (" · " or ", " separated) from a value.
function waStripMoney_(value) {
  var segs = String(value).split(/\s+·\s+|,\s+/);
  var kept = [];
  for (var i = 0; i < segs.length; i++) {
    var seg = waTrim_(segs[i]);
    if (seg && !waHasMoney_(seg)) kept.push(seg);
  }
  return kept.join(" · ");
}

// "4 personnes" -> "4 أشخاص"; meal names, egg styles, dishes -> Arabic.
function waValueAr_(value) {
  var key = waKey_(value);
  var whole = WA_VALUES_AR[key] || WA_MENU_AR[key];
  if (whole) return whole;
  return String(value).replace(/\bpersonnes?\b/gi, WA_LABELS_AR.personnes);
}

// Money-free value, each part translated: "Tomates & oignons, Salade de
// lentilles" -> "سلطة الطماطم والبصل، سلطة العدس". "" when only money.
function waPartsAr_(value) {
  var whole = WA_MENU_AR[waKey_(value)];
  if (whole) return whole;
  var kept = waStripMoney_(value);
  if (!kept) return "";
  var segs = kept.split(" · ");
  for (var i = 0; i < segs.length; i++) segs[i] = waValueAr_(segs[i]);
  return segs.join("، ");
}

// Egg counts per style: "2 Dur, 1 Brouillé, 1 Au plat" -> "2 مسلوق، 1 مخفوق، 1 مقلي".
// Zero styles are dropped; "aucun" -> "بدون بيض". Old single style ("Au plat") still works.
function waEggsAr_(value) {
  var segs = String(value).split(/\s*,\s*/);
  var out = [];
  for (var i = 0; i < segs.length; i++) {
    var seg = waTrim_(segs[i]);
    if (!seg) continue;
    var m = seg.match(/^(\d+)\s+(.+)$/);
    if (!m) {
      if (waKey_(seg) !== "aucun") out.push(WA_VALUES_AR[waKey_(seg)] || seg);
      continue;
    }
    if (Number(m[1]) === 0) continue;
    out.push(m[1] + " " + (WA_VALUES_AR[waKey_(m[2])] || m[2]));
  }
  return out.length ? out.join("، ") : WA_NO_EGGS_AR;
}

// "09:30", "9:30", "9 h 30", "9h", "9 h" -> "09:30". Empty if unknown.
function waClock_(value) {
  var m = waTrim_(value).match(/^(\d{1,2})\s*(?::|h)\s*(\d{2})?/i);
  if (!m) return "";
  var h = Number(m[1]);
  var min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return "";
  return (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min;
}

// ISO day after "yyyy-MM-dd".
function waNextDay_(iso) {
  var p = iso.split("-");
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + 1));
  var mm = d.getUTCMonth() + 1;
  var dd = d.getUTCDate();
  return d.getUTCFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
}

// RTL-safe horaire: [اليوم|غدا] dd/mm/yyyy HH:MM, LTR parts isolated.
// todayIso is "yyyy-MM-dd" in Africa/Casablanca.
function waHoraire_(details, todayIso) {
  var out = [];
  var m = String(details.date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    var iso = m[1] + "-" + m[2] + "-" + m[3];
    if (todayIso && iso === todayIso) out.push("اليوم");
    else if (todayIso && iso === waNextDay_(todayIso)) out.push("غدا");
    out.push(waIsolate_(m[3] + "/" + m[2] + "/" + m[1]));
  }
  var clock = waClock_(details.time) || waClock_(details.time_label);
  if (clock) out.push(waIsolate_(clock));
  return out.join(" ");
}

// Persons breakdown labels and age suffixes for the compact persons field.
var WA_PEOPLE_KEYS = {
  "personnes": "total",
  "adultes": "adults",
  "enfants": "children",
  "enfants 12 ans et plus": "plus_12",
  "enfants 4 a 11 ans": "de_4_a_11",
  "enfants moins de 4 ans": "moins_4"
};
var WA_AGE_AR = {
  plus_12: "12 سنة فأكثر",
  de_4_a_11: "4-11 سنة",
  moins_4: "أقل من 4 سنوات"
};

// First whole number in a value, or null when there is none.
function waCount_(value) {
  if (value == null || value === "") return null;
  var m = String(value).match(/\d+/);
  return m ? Number(m[0]) : null;
}

// "1 كبير" / "2 كبار"; "1 طفل 4-11 سنة" / "2 أطفال 4-11 سنة".
function waPeopleGroup_(n, kind) {
  if (kind === "adults") return n + " " + (n === 1 ? "كبير" : "كبار");
  var word = n === 1 ? "طفل" : "أطفال";
  return n + " " + word + (WA_AGE_AR[kind] ? " " + WA_AGE_AR[kind] : "");
}

// Compact persons field: "أشخاص : 4 (2 كبار، 1 طفل 4-11 سنة، 1 طفل أقل من 4 سنوات)".
// Structured details win over resume counts (found). "" when nothing known.
function waPeopleAr_(details, found) {
  var ages = details.children_ages && typeof details.children_ages === "object" ? details.children_ages : null;
  function pick(structured, fromResume) {
    var n = waCount_(structured);
    return n == null ? (fromResume == null ? null : fromResume) : n;
  }
  var adults = pick(details.adults, found.adults);
  var children = pick(details.children, found.children);
  var counts = {
    plus_12: pick(ages ? ages.plus_12 : null, found.plus_12),
    de_4_a_11: pick(ages ? ages.de_4_a_11 : null, found.de_4_a_11),
    moins_4: pick(ages ? ages.moins_4 : null, found.moins_4)
  };
  var groups = [];
  var sum = 0;
  if (adults) { groups.push(waPeopleGroup_(adults, "adults")); sum += adults; }
  var aged = 0;
  var order = ["plus_12", "de_4_a_11", "moins_4"];
  for (var i = 0; i < order.length; i++) {
    var n = counts[order[i]];
    if (n) { groups.push(waPeopleGroup_(n, order[i])); aged += n; }
  }
  // Children without an age bracket.
  if (children && children > aged) groups.push(waPeopleGroup_(children - aged, "children"));
  sum += Math.max(children || 0, aged);
  var total = pick(details.people, found.total);
  if (!total) total = sum || found.hidden || null;
  if (!total) return "";
  var text = WA_LABELS_AR.personnes + " : " + total;
  return groups.length ? text + " (" + groups.join("، ") + ")" : text;
}

// Arabic details without any price, on one line, fields joined by WA_SEP:
// meal, persons (compact), eggs, salads, dishes, other fields, notes last.
function waDetails_(data, details) {
  var meal = WA_SOUS_TYPE_AR[waTrim_(data.sous_type)] || "";
  var eggs = [];
  var salads = [];
  var dishes = [];
  var other = [];
  var notes = [];
  var found = {};
  var lines = String(details.resume || "").split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = waTrim_(lines[i]);
    if (!line) continue;
    var lm = line.match(/^([^:]*[^\s:\d][^:]*?)\s*:\s*(.*)$/);
    if (!lm) {
      line = waPartsAr_(line);
      if (line) other.push(line);
      continue;
    }
    var key = waKey_(lm[1]);
    var value = waTrim_(lm[2]);
    if (key === "date" || key === "heure" || key === "nom") continue;
    if (key === "repas") {
      if (!meal) meal = WA_VALUES_AR[waKey_(value)] || waPartsAr_(value);
      continue;
    }
    var first = key.split(" ")[0];
    var label = waTrim_(lm[1]);
    if (WA_MONEY_LABELS[first] && (key === first || waHasMoney_(value))) {
      // Keep a head count hidden in "Total : 4 personnes · 80 €".
      var pm = value.match(/(\d+)\s*personnes?\b/i);
      if (pm) found.hidden = Number(pm[1]);
      continue;
    }
    if (WA_MONEY_LABELS[first]) {
      // "Total quads : 2 quads" -> "quads : 2 quads": no money word for staff.
      label = waTrim_(label.replace(/^\S+\s*/, ""));
      key = waKey_(label);
    }
    if (WA_PEOPLE_KEYS[key] && waCount_(value) != null) {
      found[WA_PEOPLE_KEYS[key]] = waCount_(value);
      continue;
    }
    if (key === "oeufs") {
      value = waEggsAr_(waStripMoney_(value).replace(/ · /g, ", "));
      // Lunch / dinner: no eggs field when there is no egg.
      if (value === WA_NO_EGGS_AR && meal && meal !== WA_SOUS_TYPE_AR.breakfast) continue;
      eggs.push(WA_LABELS_AR.oeufs + " : " + value);
      continue;
    }
    if (WA_FREE_TEXT[key]) {
      // Guest text kept as written, isolated so it reads well inside Arabic.
      notes.push(WA_LABELS_AR[key] + " : " + waIsolate_(value));
      continue;
    }
    value = waPartsAr_(value);
    if (!value) continue;
    var field = (WA_LABELS_AR[key] || WA_MENU_AR[key] || label) + " : " + value;
    if (key === "salades") salads.push(field);
    else if (WA_MENU_AR[key]) dishes.push(field);
    else other.push(field);
  }
  var parts = [];
  if (meal) parts.push(meal);
  var people = waPeopleAr_(details, found);
  if (people) parts.push(people);
  return parts.concat(eggs, salads, dishes, other, notes).join(WA_SEP);
}

// True when nom_client is missing or the portal placeholder.
function waIsPlaceholderName_(name) {
  var key = waKey_(name);
  return key === "" || key === "invite" || key === "guest";
}

// Tabs searched for a stay's guest name, in order. Read only, never created.
var WA_STAY_TABS = ["Bookings", "R\u00e9servations"];
var WA_STAY_ID_COLS = ["booking_id", "id_reservation", "reservation_id", "id"];
var WA_STAY_NAME_COLS = ["nom", "guestname", "guest_name", "name", "guest"];

// Names of the portal TEST_MODE example stays (admin/js/stays.js).
// Used only while ADMIN_TEST_MODE is true and the Sheet has no match.
var WA_TEST_STAY_NAMES = {
  cmartin26a: "Camille Martin",
  jroche26bk: "Julien Roche",
  imoreau26d: "In\u00e8s Moreau"
};

// Guest name for a stay id in one tab, "" if unknown. A tab without a
// stay-id column or a name column never matches.
function waTabStayNom_(sheet, stayId) {
  if (!sheet || sheet.getLastRow() < 2) return "";
  var map = headerMap_(sheet);
  var idCol = firstCol_(map, WA_STAY_ID_COLS);
  var nameCol = firstCol_(map, WA_STAY_NAME_COLS);
  if (idCol == null || nameCol == null) return "";
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (waTrim_(values[i][idCol]) === stayId) return rowIsZeno_(values[i], map) ? waTrim_(values[i][nameCol]) : "";
  }
  return "";
}

// Guest name for a stay id: tab Bookings, then Réservations. "" if unknown.
function waStayNom_(stayId) {
  stayId = waTrim_(stayId);
  if (!stayId) return "";
  var book = SpreadsheetApp.openById(SHEET_ID);
  for (var i = 0; i < WA_STAY_TABS.length; i++) {
    var nom = waTabStayNom_(book.getSheetByName(WA_STAY_TABS[i]), stayId);
    if (nom) return nom;
  }
  return "";
}

// Guest name for staff: the posted one, or the stay's real name when the
// portal sent its placeholder. lookup(stayId) defaults to waStayNom_;
// testMode defaults to ADMIN_TEST_MODE and gates the example-stay names.
function waGuestName_(data, lookup, testMode) {
  var name = waTrim_(data.nom_client);
  if (!waIsPlaceholderName_(name)) return name;
  var details = data.details || {};
  var stayId = waTrim_(details.booking_id);
  var found = "";
  try { found = (lookup || waStayNom_)(stayId); } catch (err) { found = ""; }
  if (testMode == null) testMode = ADMIN_TEST_MODE;
  if (!found && testMode && WA_TEST_STAY_NAMES.hasOwnProperty(stayId)) found = WA_TEST_STAY_NAMES[stayId];
  return found || name;
}

// Builds the 4 body parameters: service, guest, horaire, details.
// Pure: opts.guestName (resolved name) and opts.today ("yyyy-MM-dd",
// Africa/Casablanca) are optional.
function waTemplateParams_(data, opts) {
  opts = opts || {};
  var details = data.details || {};
  var today = opts.today || Utilities.formatDate(new Date(), "Africa/Casablanca", "yyyy-MM-dd");
  return [
    waClean_(WA_SERVICE_AR[data.service] || data.service),
    waClean_(opts.guestName || data.nom_client),
    waClean_(waHoraire_(details, today)),
    waClean_(waDetails_(data, details))
  ];
}

// Sends the template. Returns { ok, wamid, code, title }. Never exposes the token.
function waSendTemplate_(to, params) {
  var token = waToken_();
  if (!token) return { ok: false, wamid: "", code: "", title: "jeton absent" };
  var res = UrlFetchApp.fetch(WA_GRAPH + WA_PHONE_NUMBER_ID + "/messages", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: {
        name: WA_TEMPLATE,
        language: { code: WA_LANG },
        components: [{
          type: "body",
          parameters: params.map(function (p) { return { type: "text", text: p }; })
        }]
      }
    })
  });
  var http = res.getResponseCode();
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (err) { body = {}; }
  var wamid = (body.messages && body.messages[0] && body.messages[0].id) || "";
  if (http >= 200 && http < 300 && wamid) return { ok: true, wamid: String(wamid), code: http, title: "" };
  var e = body.error || {};
  return {
    ok: false,
    wamid: "",
    code: e.code || http,
    title: String(e.error_user_title || e.message || ("HTTP " + http)).slice(0, 300)
  };
}

// Sends the staff WhatsApp for a new demande. Never throws: a guest
// request must not fail because of WhatsApp.
function waNotifyStaff_(data) {
  try {
    var service = String(data.service || "");
    if (!WA_STAFF.hasOwnProperty(service)) return;
    var to = waRecipient_(service);
    if (!to) return;
    var demandeId = String(data.id);
    if (!waToken_()) {
      logWhatsAppEnvoi_("", demandeId, to, { statut: "non envoyé", resultat: "jeton absent" });
      return;
    }
    var r = waSendTemplate_(to, waTemplateParams_(data, { guestName: waGuestName_(data) }));
    if (r.ok) {
      logWhatsAppEnvoi_(r.wamid, demandeId, to);
    } else {
      logWhatsAppEnvoi_("", demandeId, to, { statut: "erreur", code: r.code, titre: r.title });
    }
  } catch (err) {
    try {
      logWhatsAppEnvoi_("", String(data.id || ""), "", { statut: "erreur", titre: String((err && err.message) || err).slice(0, 300) });
    } catch (ignore) {}
  }
}

// Run from the editor to check the setup. Sends nothing.
function waCheckConfig() {
  Logger.log("Destinataires : " + (ADMIN_TEST_MODE ? "test → " + WA_TEST_TO : "réel"));
  var token = waToken_();
  if (!token) {
    Logger.log("WHATSAPP_TOKEN absent");
    return;
  }
  var res = UrlFetchApp.fetch(WA_GRAPH + WA_PHONE_NUMBER_ID + "?fields=display_phone_number,verified_name", {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (err) { body = {}; }
  Logger.log("HTTP " + res.getResponseCode()
    + " · display_phone_number=" + (body.display_phone_number || "")
    + " · verified_name=" + (body.verified_name || ""));
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

// ---------------------------------------------------------------------------
// Gmail → stays importer (2026 Airbnb and Booking.com emails).
// The parse helpers are pure (no GmailApp, no Sheet) so a local harness can
// run them. importReservationsDryRun() only reads Gmail. Only
// importReservationsFromGmail() writes.
// Needs the Gmail read scope (gmail.readonly) on the next republish.
// The inbox mixes three properties (column "bien"): Villa Zen'O, M avenue,
// Villa la tour. Never mix them:
// - Villa Zen'O → tab "Réservations" (guest portal, admin service flows).
// - Others → tab "Réservations autres biens", STATS ONLY: dates, nights,
//   guest count, amounts, source, code (dedupe only). No guest name/phone,
//   no portal link, never read by the portal, WhatsApp or admin services.
// - Unknown Booking hotel_id / Airbnb listing → autres tab as
//   "Autre (…)", never Zen'O.
// ---------------------------------------------------------------------------

var IMPORT_AFTER = "2026/01/01";
var IMPORT_QUERIES = [
  "from:automated@airbnb.com after:" + IMPORT_AFTER
    + " (subject:\"Réservation confirmée\" OR subject:annulée OR subject:annulation OR subject:modifiée"
    + " OR subject:modification OR subject:cancelled OR subject:canceled OR subject:changed)",
  "from:noreply@booking.com after:" + IMPORT_AFTER
    + " (subject:\"nouvelle réservation\" OR subject:annulation OR subject:annulée OR subject:modification"
    + " OR subject:cancellation OR subject:cancelled)"
];
var IMPORT_HEADERS = [
  "booking_id", "nom", "telephone", "date_arrivee", "date_depart", "source", "listing", "statut",
  "adultes", "enfants", "voyageurs", "notes", "total_voyageur", "devise",
  "airbnb_frais_chambre", "airbnb_reduction", "airbnb_frais_service", "airbnb_gain",
  "booking_montant", "booking_net", "gmail_id", "a_completer", "bien"
];
var IMPORT_ZENO = "Villa Zen'O";
var IMPORT_M_AVENUE = "M avenue";
var IMPORT_LA_TOUR = "Villa la tour";
// Booking.com hotel_id values that are Villa Zen'O:
// 9328474 = "Villa Zen'O Palmeraie - Hot Pool 18m - Staff".
var IMPORT_ZENO_BOOKING_HOTEL_IDS = ["9328474"];
// Booking.com hotel_id → bien. 11146148 is M avenue, NOT Zen'O.
// Any other hotel_id is never guessed: bien "Autre (<hotel_id>)".
var IMPORT_BOOKING_HOTELS = {
  "9328474": IMPORT_ZENO,
  "11146148": IMPORT_M_AVENUE,
  "11337111": IMPORT_LA_TOUR
};
// Stats-only tab for the other properties. Never read by the portal,
// WhatsApp, reservationsSheet_ or the admin service pages.
var IMPORT_OTHER_TAB = "R\u00e9servations autres biens";
// Amounts in the stay currency: brut = guest price before platform fees,
// frais = platform fees, net = payout. Empty on Booking stubs until filled
// in the Sheet ("à compléter").
var IMPORT_OTHER_HEADERS = [
  "booking_id", "bien", "source", "statut", "date_arrivee", "date_depart", "nuits", "voyageurs",
  "brut", "frais", "net", "devise", "hotel_id", "listing", "a_completer", "portail", "gmail_id"
];
// Kept as typed by staff once filled: an update never overwrites them.
var IMPORT_KEEP = { nom: 1, telephone: 1, notes: 1 };
// Set on new rows only: staff clear it once done, an update never refills it.
var IMPORT_NEW_ONLY = { a_completer: 1 };
var IMPORT_MONTHS = {
  janv: 1, janvier: 1, jan: 1, fevr: 2, fevrier: 2, fev: 2, feb: 2, mars: 3, mar: 3,
  avr: 4, avril: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6, juil: 7, juillet: 7, jul: 7,
  aout: 8, aug: 8, sept: 9, septembre: 9, sep: 9, oct: 10, octobre: 10, nov: 11, novembre: 11,
  dec: 12, decembre: 12
};

function impFold_(s) {
  return String(s || "").toLowerCase()
    .replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o").replace(/[ûüù]/g, "u")
    .replace(/ç/g, "c");
}

// True when the text names Villa Zen'O: "Zen'O", "Zen’O", "Zen O", "ZenO",
// "Zeno", any case or apostrophe ( ' ’ ‘ ʻ ` ´ ).
function impIsZenoText_(text) {
  var s = impFold_(text).replace(/[\u2019\u2018\u02bb\u02bc`\u00b4]/g, "'");
  return /\bzen[ \t\u00a0]*'?[ \t\u00a0]*o\b/.test(s) || /\bzeno\b/.test(s);
}

// Zen'O test for one parsed email (see impBien_).
function impIsZenoMsg_(stay, msg) {
  return impBien_(stay, msg) === IMPORT_ZENO;
}

function impHotelId_(msg) {
  var hid = String(msg.body || "").match(/hotel_id=(\d+)/);
  return hid ? hid[1] : "";
}

// Bien named by a listing / property name, "" when unknown.
function impBienFromText_(text) {
  if (impIsZenoText_(text)) return IMPORT_ZENO;
  var s = impFold_(text);
  if (/\bm[ \t\u00a0]*avenue\b|hivernage|rooftop/.test(s)) return IMPORT_M_AVENUE;
  if (/\bla[ \t\u00a0]+tour\b|vue[ \t\u00a0]+mer|panoramique/.test(s)) return IMPORT_LA_TOUR;
  return "";
}

// Bien for one parsed email, "" when the email does not say (e.g. an
// Airbnb cancellation without listing: filled from the confirmation by
// dedupeStays_, else "Autre (inconnu)" in importSplit_).
// Booking: the hotel_id decides (Zen'O list, then the map); an unknown
// hotel_id is "Autre (<id>)", never guessed from the name. Without hotel_id,
// the property name. Airbnb: the listing name, else subject/body.
function impBien_(stay, msg) {
  if (stay.source === "Booking.com") {
    var hid = stay.hotel_id || impHotelId_(msg);
    if (hid) {
      if (IMPORT_ZENO_BOOKING_HOTEL_IDS.indexOf(hid) >= 0) return IMPORT_ZENO;
      if (IMPORT_BOOKING_HOTELS.hasOwnProperty(hid)) return IMPORT_BOOKING_HOTELS[hid];
      return "Autre (" + hid + ")";
    }
    return impBienFromText_(stay.listing) || impBienFromText_(msg.subject) || impBienFromText_(msg.body);
  }
  if (stay.listing) return impBienFromText_(stay.listing) || "Autre (Airbnb)";
  return impBienFromText_(msg.subject) || impBienFromText_(msg.body);
}

function impMonth_(word) {
  var key = impFold_(word).replace(/[^a-z]/g, "");
  return IMPORT_MONTHS[key] || 0;
}

function impPad_(n) { return n < 10 ? "0" + n : String(n); }

function impIso_(y, m, d) { return y + "-" + impPad_(m) + "-" + impPad_(d); }

// "1 875,10 €" (spaces may be no-break) → 1875.1. "" when absent.
// "MAD17 952,00" → 17952, "4224.17" → 4224.17, "1,234.56" → 1234.56.
function impAmount_(text) {
  var s = String(text || "").replace(/[\s\u00a0\u202f\u2009]/g, "").replace(/[^\d,.\-]/g, "");
  if (!s) return "";
  var lastComma = s.lastIndexOf(",");
  var lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(/,/g, s.split(",").length > 2 ? "" : ".");
  }
  var n = Number(s);
  return isNaN(n) ? "" : Math.round(n * 100) / 100;
}

// Currency symbol / code → ISO code. DH, Dhs, MAD → MAD; € → EUR. "" if unknown.
function impCurrency_(sym) {
  var s = String(sym || "").replace(/[\s.]/g, "").toUpperCase();
  if (!s) return "";
  if (s === "\u20ac" || s === "EUR" || s === "EUROS" || s === "EURO") return "EUR";
  if (s === "DH" || s === "DHS" || s === "MAD") return "MAD";
  if (s === "$" || s === "USD") return "USD";
  if (s === "\u00a3" || s === "GBP") return "GBP";
  return /^[A-Z]{3}$/.test(s) ? s : "";
}

// Amount + currency at the END of one line, prefix or suffix currency:
// "TOTAL (MAD)   MAD17 952,00", "-MAD450,00", "VOUS GAGNEZ   6 402,00 DH",
// "Frais de chambre pour 4 nuits   2 206,00 €", "1 000 Dhs". The amount must
// follow whitespace (so "pour 4 nuits" never counts). null when absent.
var IMP_CUR_ = "(?:\u20ac|\\$|\u00a3|MAD|EUR|USD|GBP|Dhs|DHS|DH|Dh)";
var IMP_NUM_ = "(?:\\d{1,3}(?:[ \u00a0\u202f\u2009.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
var IMP_MONEY_END_ = new RegExp("(?:^|[ \\t\u00a0])(-?)[ \u00a0]?(?:(" + IMP_CUR_ + ")[ \u00a0]?(-?)(" + IMP_NUM_ + ")|(-?)(" + IMP_NUM_ + ")[ \u00a0\u202f]?(" + IMP_CUR_ + "|[A-Z]{3})?)[ \\t\u00a0]*$");
function impMoney_(line) {
  var m = String(line || "").replace(/\r/g, "").match(IMP_MONEY_END_);
  if (!m) return null;
  var neg = m[1] === "-" || m[3] === "-" || m[5] === "-";
  var num = m[4] != null ? m[4] : m[6];
  var amount = impAmount_(num);
  if (amount === "") return null;
  return { amount: neg ? -amount : amount, devise: impCurrency_(m[2] || m[7] || "") };
}

// First line that starts with a label, "" if absent.
function impLabelLine_(body, labelRe) {
  var line = String(body || "").match(new RegExp("(?:^|\\n)[ \\t]*" + labelRe + "[^\\n]*", "i"));
  return line ? line[0] : "";
}

// Amount + currency at the end of the line that starts with a label, null if absent.
function impLineMoney_(body, labelRe) {
  var line = impLabelLine_(body, labelRe);
  return line ? impMoney_(line) : null;
}

// Amount at the end of the line that starts with a label, "" if absent.
// "Frais de chambre pour 4 nuits   2 206,00 €" → 2206 (not the 4).
function impLineAmount_(body, labelRe) {
  var m = impLineMoney_(body, labelRe);
  return m ? m.amount : "";
}

// Year for a day/month with no year (Airbnb). A confirmation is normally for
// a future stay, but can arrive a little after the arrival (late or
// back-dated confirmation). Rule: the earliest of year-1 / year / year+1 that
// is no more than 60 days before the email date. E.g. email 2026-11-03 +
// "23 déc." → 2026-12-23; email 2026-12-20 + "5 janv." → 2027-01-05;
// email 2026-03-10 + "20 févr." → 2026-02-20 (past, late confirmation).
function impInferDate_(month, day, emailDate) {
  var base = emailDate instanceof Date ? emailDate : new Date(emailDate);
  var floor = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()) - 60 * 86400000;
  var y0 = base.getUTCFullYear();
  for (var y = y0 - 1; y <= y0 + 1; y++) {
    if (Date.UTC(y, month - 1, day) >= floor) return impIso_(y, month, day);
  }
  return impIso_(y0 + 1, month, day);
}

// Departure year: the arrival year, or the next one when the stay crosses New Year.
function impDepartDate_(month, day, arrivalIso) {
  if (!arrivalIso) return "";
  var y = Number(arrivalIso.slice(0, 4));
  var iso = impIso_(y, month, day);
  return iso < arrivalIso ? impIso_(y + 1, month, day) : iso;
}

function impStatut_(subject) {
  var s = impFold_(subject);
  if (/annul|cancel/.test(s)) return "annulée";
  if (/modifi|changed|change de|dates/.test(s)) return "modifiée";
  return "confirmée";
}

// Phone only when explicitly labelled; never ids, codes or URL numbers.
function impPhone_(body) {
  var m = body.match(/(?:^|\n)[ \t]*(?:téléphone|telephone|tél\.?|phone)[ \t]*:?[ \t]*(\+\d[\d  .\-]{7,18}\d)[ \t]*(?:\n|$)/i);
  return m ? m[1].replace(/[^\d+]/g, "") : "";
}

function impEmptyStay_(source, msg) {
  return {
    booking_id: "", source: source, nom: "", telephone: "", adultes: "", enfants: "", notes: "",
    date_arrivee: "", date_depart: "", listing: "", statut: impStatut_(msg.subject), voyageurs: "",
    total: "", devise: "", airbnb_frais_chambre: "", airbnb_reduction: "", airbnb_frais_service: "",
    airbnb_gain: "", booking_montant: "", booking_net: "",
    gmail_id: msg.id || "", email_date: "", a_completer: "", zeno: "", bien: "", hotel_id: ""
  };
}

// "jeu. 20 mai 2027   dim. 30 mai 2027" or "mer. 23 déc.   dim. 27 déc."
// → [{ day, month, year|0 }, …] in order. Weekday words carry no digit and
// are skipped; a 4-digit year right after the month belongs to that date.
function impDayMonths_(line) {
  var out = [];
  var re = /(\d{1,2})[ \t\u00a0]+([^\s\d,;()\u2013\-]+)(?:[ \t\u00a0]+(\d{4})\b)?/g;
  var m;
  while ((m = re.exec(String(line || ""))) !== null) {
    var month = impMonth_(m[2]);
    if (month) out.push({ day: Number(m[1]), month: month, year: m[3] ? Number(m[3]) : 0 });
  }
  return out;
}

// Arrival / departure ISO from two parsed dates. A written year is used as
// is (never inferred); without one, the arrival year comes from the email
// date (impInferDate_) and the departure follows the arrival.
function impStayDates_(a, d, emailDate) {
  var res = { arrivee: "", depart: "" };
  if (!a) return res;
  if (a.year) res.arrivee = impIso_(a.year, a.month, a.day);
  else if (d && d.year) res.arrivee = impIso_(a.month > d.month ? d.year - 1 : d.year, a.month, a.day);
  else if (emailDate && !isNaN(emailDate.getTime())) res.arrivee = impInferDate_(a.month, a.day, emailDate);
  if (d && res.arrivee) res.depart = d.year ? impIso_(d.year, d.month, d.day) : impDepartDate_(d.month, d.day, res.arrivee);
  return res;
}

// Airbnb cancellation range: "(19–23 oct.)", "(15–20 juil. 2026)",
// "(28 juin–2 juil.)", "19–23 oct., 8 voyageurs" (en dash or hyphen).
// Returns [arrival, departure] day/months or null.
function impRange_(text) {
  var m = String(text || "").match(/(\d{1,2})(?:[ \t\u00a0]+([^\s\d,()\u2013\-]+?)\.?)?(?:[ \t\u00a0]+(\d{4}))?[ \t\u00a0]*[\u2013\u2014\-][ \t\u00a0]*(\d{1,2})[ \t\u00a0]+([^\s\d,()]+?)\.?(?:[ \t\u00a0]+(\d{4}))?(?=[\s,)]|$)/);
  if (!m) return null;
  var dm = impMonth_(m[5]);
  if (!dm) return null;
  var am = m[2] ? impMonth_(m[2]) : dm;
  if (!am) return null;
  var dy = m[6] ? Number(m[6]) : 0;
  return [{ day: Number(m[1]), month: am, year: m[3] ? Number(m[3]) : 0 }, { day: Number(m[4]), month: dm, year: dy }];
}

function impParseAirbnb_(msg) {
  var subject = String(msg.subject || "");
  var body = String(msg.body || "").replace(/\r/g, "");
  var stay = impEmptyStay_("Airbnb", msg);
  var date = msg.date instanceof Date ? msg.date : new Date(msg.date);
  stay.email_date = isNaN(date.getTime()) ? "" : date.toISOString();

  var code = body.match(/CODE DE CONFIRMATION\s*\n\s*([A-Z0-9]{8,12})\b/)
    || body.match(/\/reservations\/details\/(HM[A-Z0-9]{6,10})\b/)
    || subject.match(/\b(HM[A-Z0-9]{6,10})\b/)
    || body.match(/\b(HM[A-Z0-9]{8})\b/);
  if (!code) return null;
  stay.booking_id = code[1];

  var cancelled = stay.statut === "annulée";
  var name = subject.match(/confirmée\s*:\s*(.+?)\s+arrive le\b/i);
  if (name) stay.nom = name[1].replace(/\s+/g, " ").trim();
  // Text after the details URL on the same line: the guest name in a
  // confirmation, the listing in a cancellation ("RÉSERVATION ANNULÉE").
  var link = body.match(/\/reservations\/details\/[A-Z0-9]+\S*[ \t\u00a0]{2,}([^\n\[]+)/);
  var afterLink = link ? link[1].replace(/[ \t\u00a0]+$/, "").trim() : "";
  if (!stay.nom && afterLink && !cancelled) stay.nom = afterLink;

  var listing = body.match(/\n[ \t]*([^\n]+?)[ \t]*\n\s*(?:Logement entier|Chambre privée|Entire home)/i);
  if (listing && !/^https?:/.test(listing[1].trim())) stay.listing = listing[1].trim();
  if (!stay.listing && cancelled && afterLink) stay.listing = afterLink;

  // "Arrivée   Départ", then (after optional blank lines) one line with
  // both dates, each with an optional year: "jeu. 20 mai 2027   dim. 30 mai 2027".
  var head = body.match(/Arrivée[ \t\u00a0]+Départ[^\n]*\n(?:[ \t\u00a0]*\n)*([^\n]*\d[^\n]*)/i);
  var dm = head ? impDayMonths_(head[1]) : [];
  if (!dm.length) {
    // Cancellation: subject "(19–23 oct.[ 2026])", else the body line
    // "19–23 oct., 8 voyageurs".
    var range = impRange_((subject.match(/\(([^()]*\d[^()]*)\)/) || [])[1]);
    if (!range) {
      var gl = body.match(/(?:^|\n)[ \t\u00a0]*([^\n]*\d[ \t\u00a0]*[\u2013\u2014\-][^\n]*?,[ \t\u00a0]*\d+[ \t\u00a0]+voyageurs?)/i);
      range = gl ? impRange_(gl[1]) : null;
    }
    if (range) dm = range;
  }
  if (dm.length) {
    var sd = impStayDates_(dm[0], dm[1], date);
    stay.date_arrivee = sd.arrivee;
    stay.date_depart = sd.depart;
  }
  if (!stay.date_arrivee) {
    var arr = subject.match(/arrive le\s+(\d{1,2})\s+([^\s\d]+)(?:\s+(\d{4}))?/i);
    if (arr && impMonth_(arr[2])) {
      stay.date_arrivee = arr[3] ? impIso_(Number(arr[3]), impMonth_(arr[2]), Number(arr[1]))
        : (isNaN(date.getTime()) ? "" : impInferDate_(impMonth_(arr[2]), Number(arr[1]), date));
    }
  }
  var count = body.match(/(?:^|[\s,])(\d+)[ \t\u00a0]+voyageurs?\b/i);
  if (count && cancelled) stay.voyageurs = Number(count[1]);

  var guests = body.match(/VOYAGEURS\s*\n\s*([^\n]+)/);
  if (guests) {
    var g = guests[1];
    var a = g.match(/(\d+)\s*adulte/i);
    var c = g.match(/(\d+)\s*enfant/i);
    var b = g.match(/(\d+)\s*bébé/i);
    if (a) stay.adultes = Number(a[1]);
    if (a || c) stay.enfants = c ? Number(c[1]) : 0;
    if (b) stay.notes = b[1] + (Number(b[1]) > 1 ? " bébés" : " bébé");
    if (a || c) stay.voyageurs = (a ? Number(a[1]) : 0) + (c ? Number(c[1]) : 0);
  }

  // Amounts: currency as prefix or suffix ("MAD17 952,00", "7 898,91 DH",
  // "1 875,10 €"); DH / Dhs = MAD. devise is always set with an amount: the
  // TOTAL (XXX) code first, else the currency written next to any amount.
  var seen = [];
  function take(m) { if (m && m.devise) seen.push(m.devise); return m ? m.amount : ""; }
  var totalLine = impLabelLine_(body, "TOTAL[ \\t\\u00a0]*\\(");
  if (totalLine) {
    stay.total = take(impMoney_(totalLine));
    var cur = totalLine.match(/TOTAL[ \t\u00a0]*\(([^)]+)\)/i);
    if (cur && impCurrency_(cur[1])) seen.unshift(impCurrency_(cur[1]));
  }

  // Host payout block: room fee, reductions/adjustments (stored positive),
  // host service fee (stored positive) and payout, as the admin form expects.
  var payout = body.split(/VERSEMENT DE L'HÔTE|VERSEMENT DE L’HÔTE/)[1] || "";
  stay.airbnb_frais_chambre = take(impLineMoney_(payout, "Frais de chambre"));
  stay.airbnb_gain = take(impLineMoney_(body, "VOUS GAGNEZ"));
  var fee = take(impLineMoney_(payout, "Frais de service hôte"));
  if (fee !== "") stay.airbnb_frais_service = Math.abs(fee);
  var lines = payout.split(/VOUS GAGNEZ/)[0].split("\n");
  var reduction = 0;
  var hasReduction = false;
  for (var i = 0; i < lines.length; i++) {
    if (/Frais de service|Frais de chambre/i.test(lines[i])) continue;
    var neg = impMoney_(lines[i]);
    if (neg && neg.amount < 0) { reduction += Math.abs(take(neg)); hasReduction = true; }
  }
  if (hasReduction) stay.airbnb_reduction = Math.round(reduction * 100) / 100;
  if (stay.total !== "" || stay.airbnb_frais_chambre !== "" || stay.airbnb_gain !== "") stay.devise = seen[0] || "";

  stay.telephone = impPhone_(body);
  return stay;
}

function impParseBooking_(msg) {
  var subject = String(msg.subject || "");
  var body = String(msg.body || "").replace(/\r/g, "");
  var stay = impEmptyStay_("Booking.com", msg);
  var date = msg.date instanceof Date ? msg.date : new Date(msg.date);
  stay.email_date = isNaN(date.getTime()) ? "" : date.toISOString();

  var head = subject.match(/\((\d{8,12}),\s*[^\d,]*?(\d{1,2})\s+([^\s\d]+)\s+(\d{4})\)/);
  var code = head ? head[1] : "";
  if (!code) {
    var c = body.match(/Booking confirmation\s*[—\-]+\s*(\d{8,12})/) || body.match(/res_id=(\d{8,12})/);
    if (c) code = c[1];
  }
  if (!code) return null;
  stay.booking_id = code;
  stay.hotel_id = impHotelId_(msg);
  if (head && impMonth_(head[3])) stay.date_arrivee = impIso_(Number(head[4]), impMonth_(head[3]), Number(head[2]));

  // Property name: first text line after the security banner.
  var parts = body.split(/avant de vous connecter\.?/);
  if (parts.length > 1) {
    var rest = parts[1].split("\n");
    for (var i = 0; i < rest.length; i++) {
      var line = rest[i].replace(/[\t ]/g, " ").trim();
      if (!line || /^https?:|^\[/.test(line)) continue;
      if (/Booking confirmation/i.test(line)) break;
      stay.listing = line.replace(/^Booking\.com\s+/, "").trim();
      break;
    }
  }
  // The stub has no guest name, phone, checkout, guests or amounts: left "",
  // flagged for staff to complete in admin.
  stay.a_completer = "à compléter";
  return stay;
}

// Pure: { from, subject, date, body, id } → stay object or null.
// stay.bien is the property ("" when the email does not say); stay.zeno is
// true when it is Villa Zen'O, "" otherwise.
function parseReservationEmail_(msg) {
  var stay = parseReservationEmailRaw_(msg);
  if (stay) {
    stay.bien = impBien_(stay, msg);
    stay.zeno = stay.bien === IMPORT_ZENO ? true : "";
  }
  return stay;
}

function parseReservationEmailRaw_(msg) {
  if (!msg) return null;
  var from = String(msg.from || "").toLowerCase();
  var subject = impFold_(msg.subject);
  if (from.indexOf("automated@airbnb.com") >= 0) {
    if (!/reservation confirmee|annul|cancel|modifi|changed/.test(subject)) return null;
    return impParseAirbnb_(msg);
  }
  if (/(^|[<\s"])noreply@booking\.com/.test(from)) {
    if (!/nouvelle reservation|annul|cancel|modifi/.test(subject)) return null;
    if (/facture|invoice|connexion|sign.?in|mot de passe|password/.test(subject)) return null;
    return impParseBooking_(msg);
  }
  return null;
}

// Pure: one stay per booking_id (confirmation code). The latest email wins
// field by field; older emails only fill fields the latest one lacks: a
// later cancellation keeps statut "annulée" and inherits name, amounts and
// listing from the confirmation. A cancellation alone still gives one row
// (code, dates, listing, guests from the cancellation itself).
// Different codes are different bookings, even when the dates overlap on
// the same property (e.g. Villa la tour 13→19 and 18→21 juil. 2026, or a
// new code booked after a cancellation): never merged, see importOverlaps_.
// Running it again on the same messages gives the same stays.
function dedupeStays_(stays) {
  var sorted = stays.filter(function (s) { return s && s.booking_id; }).sort(function (a, b) {
    return a.email_date < b.email_date ? 1 : (a.email_date > b.email_date ? -1 : 0);
  });
  var byId = {};
  var order = [];
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    var cur = byId[s.booking_id];
    if (!cur) { byId[s.booking_id] = s; order.push(s.booking_id); continue; }
    for (var k in s) if (s.hasOwnProperty(k) && cur[k] === "" && s[k] !== "") cur[k] = s[k];
  }
  return order.map(function (id) { return byId[id]; }).sort(function (a, b) {
    return a.date_arrivee < b.date_arrivee ? -1 : (a.date_arrivee > b.date_arrivee ? 1 : 0);
  });
}

// Pure: confirmed stays of the same bien whose nights overlap, with
// different codes. Kept as separate bookings; reported in the dry run only
// (bien + dates, no code, no guest data).
function importOverlaps_(stays) {
  var out = [];
  var live = stays.filter(function (s) { return s.statut !== "annulée" && s.date_arrivee && s.date_depart; });
  for (var i = 0; i < live.length; i++) {
    for (var j = i + 1; j < live.length; j++) {
      var a = live[i];
      var b = live[j];
      if ((a.bien || "") !== (b.bien || "") || a.booking_id === b.booking_id) continue;
      if (a.date_arrivee < b.date_depart && b.date_arrivee < a.date_depart) {
        out.push({ bien: a.bien || "", a: a.date_arrivee + " → " + a.date_depart, b: b.date_arrivee + " → " + b.date_depart });
      }
    }
  }
  return out;
}

// Pure: counts by source, arrival month and statut.
function importCounts_(stays, messages) {
  var counts = { messages: messages, stays: stays.length, bySource: {}, byMonth: {}, byStatut: {} };
  for (var i = 0; i < stays.length; i++) {
    var s = stays[i];
    var month = s.date_arrivee ? s.date_arrivee.slice(0, 7) : "?";
    counts.bySource[s.source] = (counts.bySource[s.source] || 0) + 1;
    counts.byMonth[month] = (counts.byMonth[month] || 0) + 1;
    counts.byStatut[s.statut] = (counts.byStatut[s.statut] || 0) + 1;
  }
  return counts;
}

function impNights_(a, b) {
  var pa = String(a).split("-");
  var pb = String(b).split("-");
  var n = Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  return isNaN(n) || n < 0 ? "" : n;
}

function impRound_(n) { return Math.round(n * 100) / 100; }

// Pure: stats-only row for a stay of another property. Keeps only what the
// stats need; never the guest name, phone or notes. booking_id is for
// dedupe only (not a portal stay id, no lien_actif).
function importOtherRow_(s) {
  var brut = "";
  var frais = "";
  var net = "";
  if (s.source === "Airbnb") {
    brut = s.airbnb_frais_chambre !== "" ? impRound_(Number(s.airbnb_frais_chambre) - (Number(s.airbnb_reduction) || 0)) : s.total;
    frais = s.airbnb_frais_service;
    net = s.airbnb_gain !== "" ? s.airbnb_gain : (brut !== "" && frais !== "" ? impRound_(brut - frais) : "");
  } else {
    brut = s.booking_montant;
    net = s.booking_net;
    if (brut !== "" && net !== "") frais = impRound_(brut - net);
  }
  return {
    booking_id: s.booking_id, bien: s.bien, source: s.source, statut: s.statut,
    date_arrivee: s.date_arrivee, date_depart: s.date_depart,
    nuits: s.date_arrivee && s.date_depart ? impNights_(s.date_arrivee, s.date_depart) : "",
    voyageurs: s.adultes === "" && s.enfants === "" ? (s.voyageurs === "" || s.voyageurs == null ? "" : Number(s.voyageurs))
      : (Number(s.adultes) || 0) + (Number(s.enfants) || 0),
    brut: brut, frais: frais, net: net, devise: s.devise, hotel_id: s.hotel_id || "",
    listing: s.listing, a_completer: s.a_completer, portail: "non", gmail_id: s.gmail_id
  };
}

// Pure: splits deduped stays by bien. Villa Zen'O stays are kept whole
// (portal tab). Others become stats-only rows (importOtherRow_). A stay
// whose bien is still unknown becomes "Autre (inconnu)". skipped / unknown
// hold counts and property ids/names only, never guest data.
// Returns { zeno, others, skipped, unknown }.
function importSplit_(stays) {
  var zeno = [];
  var others = [];
  var skipped = { total: 0, bySource: {}, byBien: {}, byListing: {} };
  var unknown = [];
  var seen = {};
  for (var i = 0; i < stays.length; i++) {
    var s = stays[i];
    if (!s.bien) s.bien = "Autre (inconnu)";
    s.zeno = s.bien === IMPORT_ZENO ? true : "";
    if (s.zeno === true) { zeno.push(s); continue; }
    var listing = s.listing || "(listing inconnu)";
    skipped.total += 1;
    skipped.bySource[s.source] = (skipped.bySource[s.source] || 0) + 1;
    skipped.byBien[s.bien] = (skipped.byBien[s.bien] || 0) + 1;
    skipped.byListing[listing] = (skipped.byListing[listing] || 0) + 1;
    if (/^Autre/.test(s.bien)) {
      var key = s.source + "|" + (s.hotel_id || "") + "|" + listing;
      if (!seen[key]) { seen[key] = 1; unknown.push({ source: s.source, hotel_id: s.hotel_id || "", listing: listing }); }
    }
    others.push(importOtherRow_(s));
  }
  return { zeno: zeno, others: others, skipped: skipped, unknown: unknown };
}

// Pure: Zen'O stays (portal) and a count of the other properties, by
// source / bien / listing, without guest data. Returns { stays, skipped }.
function importFilterZeno_(stays) {
  var sp = importSplit_(stays);
  return { stays: sp.zeno, skipped: sp.skipped };
}

// Pure: importCounts_ per bien, over Zen'O stays and other-property rows.
function importCountsByBien_(zeno, others) {
  var groups = {};
  var all = zeno.concat(others);
  for (var i = 0; i < all.length; i++) {
    var b = all[i].bien || "Autre (inconnu)";
    (groups[b] = groups[b] || []).push(all[i]);
  }
  var out = {};
  for (var k in groups) {
    if (!groups.hasOwnProperty(k)) continue;
    var c = importCounts_(groups[k], "");
    delete c.messages;
    c.portail = k === IMPORT_ZENO;
    out[k] = c;
  }
  return out;
}

// Reads Gmail only. Returns { messages, stays (Zen'O), others (stats-only
// rows), skipped, unknown }.
function importGmailStays_() {
  var parsed = [];
  var messages = 0;
  for (var q = 0; q < IMPORT_QUERIES.length; q++) {
    for (var start = 0; start < 500; start += 100) {
      var threads = GmailApp.search(IMPORT_QUERIES[q], start, 100);
      for (var t = 0; t < threads.length; t++) {
        var msgs = threads[t].getMessages();
        for (var m = 0; m < msgs.length; m++) {
          messages += 1;
          var stay = parseReservationEmail_({
            id: msgs[m].getId(),
            from: msgs[m].getFrom(),
            subject: msgs[m].getSubject(),
            date: msgs[m].getDate(),
            body: msgs[m].getPlainBody()
          });
          if (stay) parsed.push(stay);
        }
      }
      if (threads.length < 100) break;
    }
  }
  var unique = dedupeStays_(parsed);
  var overlaps = importOverlaps_(unique);
  var sp = importSplit_(unique);
  return { messages: messages, stays: sp.zeno, others: sp.others, skipped: sp.skipped, unknown: sp.unknown, overlaps: overlaps };
}

function importLogLine_(s) {
  var guests = s.adultes === "" && s.enfants === "" && s.voyageurs !== "" && s.voyageurs != null ? s.voyageurs + " voy."
    : (s.adultes === "" ? "?" : s.adultes) + "A/" + (s.enfants === "" ? "?" : s.enfants) + "E";
  return [s.bien || IMPORT_ZENO, s.source, s.booking_id, s.statut, (s.date_arrivee || "?") + " → " + (s.date_depart || "?"),
    s.listing, s.nom || "(sans nom)", guests,
    s.total === "" ? "" : Number(s.total).toFixed(2) + " " + s.devise,
    s.airbnb_gain === "" ? "" : "gain " + Number(s.airbnb_gain).toFixed(2)]
    .concat(s.a_completer ? [s.a_completer] : []).join(" · ");
}

// Other-property row for logs: no code, no guest data.
function importOtherLogLine_(r) {
  return [r.bien, r.source, r.statut, (r.date_arrivee || "?") + " → " + (r.date_depart || "?"),
    (r.nuits === "" ? "?" : r.nuits) + " nuits", (r.voyageurs === "" ? "?" : r.voyageurs) + " voy.",
    r.brut === "" ? "brut ?" : "brut " + Number(r.brut).toFixed(2) + " " + r.devise,
    r.net === "" ? "net ?" : "net " + Number(r.net).toFixed(2)]
    .concat(r.a_completer ? [r.a_completer] : []).join(" · ");
}

// Run from the editor. Reads Gmail, writes nothing, never opens the Sheet.
// Logs counts per bien, Zen'O rows without phone numbers, other-property
// rows without code or guest data, and unknown hotel_id / listing names.
function importReservationsDryRun() {
  var res = importGmailStays_();
  var counts = importCounts_(res.stays, res.messages);
  counts.skipped = res.skipped;
  counts.byBien = importCountsByBien_(res.stays, res.others);
  counts.unknown = res.unknown;
  counts.overlaps = res.overlaps;
  Logger.log("Dry run : " + JSON.stringify(counts));
  for (var o = 0; o < res.overlaps.length; o++) {
    Logger.log("Chevauchement " + res.overlaps[o].bien + " : " + res.overlaps[o].a + " / " + res.overlaps[o].b + " — codes différents, deux réservations gardées");
  }
  for (var i = 0; i < res.stays.length; i++) Logger.log(importLogLine_(res.stays[i]));
  for (i = 0; i < res.others.length; i++) Logger.log(importOtherLogLine_(res.others[i]));
  return { ok: true, dryRun: true, counts: counts, skipped: res.skipped, unknown: res.unknown, stays: res.stays, others: res.others };
}

// Sheet row values for a Zen'O stay, by header name.
function importValues_(s) {
  return {
    booking_id: s.booking_id, nom: s.nom, telephone: s.telephone,
    date_arrivee: s.date_arrivee, date_depart: s.date_depart, source: s.source,
    listing: s.listing, statut: s.statut, adultes: s.adultes, enfants: s.enfants, voyageurs: s.voyageurs, notes: s.notes,
    total_voyageur: s.total, devise: s.devise,
    airbnb_frais_chambre: s.airbnb_frais_chambre, airbnb_reduction: s.airbnb_reduction,
    airbnb_frais_service: s.airbnb_frais_service, airbnb_gain: s.airbnb_gain,
    booking_montant: s.booking_montant, booking_net: s.booking_net, gmail_id: s.gmail_id,
    a_completer: s.a_completer, bien: IMPORT_ZENO
  };
}

// Adds the missing headers at the end of row 1. Returns the 0-based map.
function importEnsureHeaders_(sheet, headers) {
  var map = sheet.getLastColumn() ? headerMap_(sheet) : {};
  var col = sheet.getLastColumn();
  for (var i = 0; i < headers.length; i++) {
    if (map[headers[i]] != null) continue;
    col += 1;
    sheet.getRange(1, col).setValue(headers[i]).setFontWeight("bold");
    map[headers[i]] = col - 1;
  }
  return map;
}

// Idempotent upsert keyed on booking_id (the confirmation code) in this tab:
// an existing row is found and updated, never appended a second time, so a
// re-run adds nothing. Ids are compared trimmed, as text (a Booking id typed
// as a number still matches). Updates happen only when the statut changed
// (cancel / change) or to fill empty cells. keep: columns never overwritten
// once filled. fresh(row, map): defaults for new rows.
// Returns { added, updated }.
function importUpsert_(sheet, map, list, valuesOf, keep, fresh) {
  var width = sheet.getLastColumn();
  var idCol = map.booking_id;
  var last = sheet.getLastRow();
  var existing = last < 2 ? [] : sheet.getRange(2, 1, last - 1, width).getValues();
  var rowOf = {};
  var used = 0; // rows holding data; checkbox-only rows (all FALSE) are free
  var i;
  for (i = 0; i < existing.length; i++) {
    var key = String(existing[i][idCol] == null ? "" : existing[i][idCol]).trim();
    if (key !== "" && !rowOf.hasOwnProperty(key)) rowOf[key] = i;
    for (var x = 0; x < width; x++) {
      if (existing[i][x] !== "" && existing[i][x] !== false) { used = i + 1; break; }
    }
  }
  var added = [];
  var addedIds = {};
  var updated = 0;
  for (i = 0; i < list.length; i++) {
    var values = valuesOf(list[i]);
    var keys = Object.keys(values);
    var id = String(values.booking_id == null ? "" : values.booking_id).trim();
    var k;
    if (id === "" || addedIds.hasOwnProperty(id)) continue; // no id, or twice in one run
    if (rowOf.hasOwnProperty(id)) {
      var idx = rowOf[id];
      var row = existing[idx].slice();
      var changed = map.statut != null && String(row[map.statut]) !== String(values.statut);
      var dirty = false;
      for (k = 0; k < keys.length; k++) {
        var c = map[keys[k]];
        var v = values[keys[k]];
        if (c == null || v === "" || v == null || IMPORT_NEW_ONLY[keys[k]]) continue;
        var empty = row[c] === "" || row[c] == null;
        if (empty || (changed && !keep[keys[k]])) {
          if (String(row[c]) !== String(v)) { row[c] = v; dirty = true; }
        }
      }
      if (dirty) {
        sheet.getRange(idx + 2, 1, 1, width).setValues([row]);
        updated += 1;
      }
      continue;
    }
    var row2 = [];
    for (k = 0; k < width; k++) row2.push("");
    for (k = 0; k < keys.length; k++) if (map[keys[k]] != null) row2[map[keys[k]]] = values[keys[k]];
    if (fresh) fresh(row2, map);
    addedIds[id] = 1;
    added.push(row2);
  }
  if (added.length) {
    var need = used + 1 + added.length - sheet.getMaxRows();
    if (need > 0) sheet.insertRowsAfter(sheet.getMaxRows(), need);
    sheet.getRange(used + 2, 1, added.length, width).setValues(added);
  }
  return { added: added.length, updated: updated };
}

// WRITES. Run by hand only, no trigger.
// Villa Zen'O → "Réservations" (created with its headers if missing; the
// English Bookings tab is not touched). Staff-typed nom, telephone and notes
// are never overwritten.
// Other properties → "Réservations autres biens", stats-only rows (no guest
// name/phone, portail "non"). Amounts / checkout typed later in the Sheet on
// Booking stubs are never overwritten by an empty import value.
function importReservationsFromGmail() {
  var res = importGmailStays_();
  var i;
  for (i = 0; i < res.stays.length; i++) {
    if (res.stays[i].zeno !== true || res.stays[i].bien !== IMPORT_ZENO) throw new Error("Import: non Zen'O stay reached the Réservations tab");
  }
  for (i = 0; i < res.others.length; i++) {
    var o = res.others[i];
    if (o.bien === IMPORT_ZENO || o.hasOwnProperty("nom") || o.hasOwnProperty("telephone")) throw new Error("Import: bad row for the autres biens tab");
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Réservations") || ss.insertSheet("Réservations");
  importEnsureHeaders_(sheet, IMPORT_HEADERS);
  var book = reservationsSheet_(); // adds the remaining admin columns
  var zen = importUpsert_(book.sheet, headerMap_(book.sheet), res.stays, importValues_, IMPORT_KEEP, function (row, map) {
    if (map.offert_petit_dejeuner != null) row[map.offert_petit_dejeuner] = false;
  });

  var other = { added: 0, updated: 0 };
  if (res.others.length) {
    var tab = ss.getSheetByName(IMPORT_OTHER_TAB) || ss.insertSheet(IMPORT_OTHER_TAB);
    var omap = importEnsureHeaders_(tab, IMPORT_OTHER_HEADERS);
    other = importUpsert_(tab, omap, res.others, function (r) { return r; }, {}, null);
  }

  var counts = importCounts_(res.stays, res.messages);
  counts.added = zen.added;
  counts.updated = zen.updated;
  counts.skipped = res.skipped;
  counts.autres = { added: other.added, updated: other.updated };
  counts.byBien = importCountsByBien_(res.stays, res.others);
  counts.unknown = res.unknown;
  Logger.log("Import : " + JSON.stringify(counts));
  return { ok: true, counts: counts };
}
