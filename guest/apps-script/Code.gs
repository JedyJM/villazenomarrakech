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
  if (params.action === "stays" || params.action === "stay" || params.action === "demandes" || params.action === "depenses" || params.action === "get-reglages") return adminGet_(params);
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
  if (params.action === "get-reglages") return jsonOut({ ok: true, reglages: readReglages_() });
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

// Makes a value safe for a template body parameter (no newlines/tabs,
// no runs of spaces, max 900 chars, never empty).
function waClean_(value) {
  var text = String(value == null ? "" : value)
    .replace(/\r?\n/g, " · ")
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
  "depart": "الانطلاق"
};

// Whole French values translated for staff (accent-free, lower case keys).
var WA_VALUES_AR = {
  "petit-dejeuner": "الفطور",
  "dejeuner": "الغداء",
  "diner": "العشاء"
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

// "4 personnes" -> "4 أشخاص"; whole meal names -> Arabic.
function waValueAr_(value) {
  var whole = WA_VALUES_AR[waKey_(value)];
  if (whole) return whole;
  return String(value).replace(/\bpersonnes?\b/gi, WA_LABELS_AR.personnes);
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

// Arabic details without any price, meal shown once.
function waDetails_(data, details) {
  var meal = WA_SOUS_TYPE_AR[waTrim_(data.sous_type)] || "";
  var parts = [];
  var people = "";
  var hasPeople = false;
  var lines = String(details.resume || "").split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = waTrim_(lines[i]);
    if (!line) continue;
    var lm = line.match(/^([^:]*[^\s:\d][^:]*?)\s*:\s*(.*)$/);
    if (!lm) {
      line = waValueAr_(waStripMoney_(line));
      if (line) parts.push(line);
      continue;
    }
    var key = waKey_(lm[1]);
    var value = waTrim_(lm[2]);
    if (key === "date" || key === "heure" || key === "nom") continue;
    if (key === "repas" && meal) continue;
    var first = key.split(" ")[0];
    if (WA_MONEY_LABELS[first] && (key === first || waHasMoney_(value))) {
      // Keep a head count hidden in "Total : 4 personnes · 80 €".
      var pm = value.match(/(\d+)\s*personnes?\b/i);
      if (pm) people = pm[1];
      continue;
    }
    if (key === "personnes") hasPeople = true;
    if (!WA_FREE_TEXT[key]) {
      value = waValueAr_(waStripMoney_(value));
      if (!value) continue;
    }
    parts.push((WA_LABELS_AR[key] || waTrim_(lm[1])) + " : " + value);
  }
  if (people && !hasPeople) parts.push(WA_LABELS_AR.personnes + " : " + people);
  if (meal) parts.unshift(meal);
  return parts.join(" · ");
}

// True when nom_client is missing or the portal placeholder.
function waIsPlaceholderName_(name) {
  var key = waKey_(name);
  return key === "" || key === "invite" || key === "guest";
}

// Réservations.nom for a stay id, "" if unknown. Read only.
function waStayNom_(stayId) {
  stayId = waTrim_(stayId);
  if (!stayId) return "";
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("R\u00e9servations");
  if (!sheet || sheet.getLastRow() < 2) return "";
  var map = headerMap_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var stay = stayFromRow_(values[i], map);
    if (stay.id === stayId) return waTrim_(stay.nom);
  }
  return "";
}

// Guest name for staff: the posted one, or the stay's real name when the
// portal sent its placeholder. lookup(stayId) defaults to waStayNom_.
function waGuestName_(data, lookup) {
  var name = waTrim_(data.nom_client);
  if (!waIsPlaceholderName_(name)) return name;
  var details = data.details || {};
  var found = "";
  try { found = (lookup || waStayNom_)(details.booking_id); } catch (err) { found = ""; }
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
