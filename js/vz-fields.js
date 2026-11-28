/* Villa Zen'O shared field model (site <-> Apps Script).
   The block between BEGIN VZ_FIELDS and END VZ_FIELDS is copied VERBATIM
   into the Apps Script (Code.v21.gs). tests/verify/fields.test.js fails
   when the two copies differ. ES5 only, no DOM, no Apps Script service:
   it runs in the browser, in Node (tests, mock /exec) and in Apps Script.

   What it fixes: one fact = one reader. Requested day/time of a demande
   per service, guest name of a stay, confirmation date, the public stay
   record sent to the guest portal, the list item of Mes demandes and the
   one-line summary of the Confirmer page. */
(function (root) {
  "use strict";

// BEGIN VZ_FIELDS
var VZF_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
var VZF_PLACEHOLDER_NAMES = { "": 1, "invite": 1, "guest": 1, "exemple": 1 };
// Public stay fields answered to a valid guest link (action=list).
var VZF_STAY_FIELDS = ["id", "prenom", "nom", "arrival", "departure", "lien_actif", "lien_expire_le", "pool", "jacuzzi", "source", "adults", "children", "children_4_11", "under_4", "encaisse_total_eur", "encaisse_mode", "encaisse_le", "offerts"];
// Mes demandes item fields (action=list items[]).
var VZF_ITEM_FIELDS = ["id", "date_creation", "service", "sous_type", "nom_client", "total", "unit", "status", "offert", "when_date", "when_time", "date_confirmation", "meal", "people", "supplement", "bill", "dish", "activity", "activity_label", "scope", "trip_type", "destination", "car_type", "adults", "kids_4_11", "kids_under_4", "extras"];

function vzfPad_(n) { return (n < 10 ? "0" : "") + n; }

function vzfIsDate_(value) { return Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime()); }

// "yyyy-MM-dd" from text or a Date cell; "" otherwise.
function vzfIso_(value) {
  if (vzfIsDate_(value)) return value.getFullYear() + "-" + vzfPad_(value.getMonth() + 1) + "-" + vzfPad_(value.getDate());
  var m = String(value == null ? "" : value).match(/^\s*(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
}

// "HH:MM" from "9:30", "09:30:00", "9h30", "9 h", "9 h 30"; "" when there is no real time.
// Never invents 00:00: a missing time stays "".
function vzfClock_(value) {
  if (vzfIsDate_(value)) return vzfPad_(value.getHours()) + ":" + vzfPad_(value.getMinutes());
  var m = String(value == null ? "" : value).replace(/ /g, " ").match(/^\s*(\d{1,2})\s*(?::|h|H)\s*(\d{2})?/);
  if (!m) return "";
  var h = Number(m[1]);
  var min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return "";
  return vzfPad_(h) + ":" + vzfPad_(min);
}

/* Requested day and time of a demande, one rule per service:
   transfert         date + flight_arrival_time (arrival) | pickup_time (departure)
   course            date + pickup_time
   location_voiture  start_date + pickup_time
   others            date + time (time_label as fallback) */
function vzfWhen_(service, details) {
  var d = details || {};
  var s = String(service || "");
  var date = d.date;
  var time = d.time || d.time_label;
  if (s === "location_voiture") { date = d.start_date || d.date; time = d.pickup_time || d.time; }
  else if (s === "course") { time = d.pickup_time || d.time; }
  else if (s === "transfert") {
    time = d.trip_type === "departure" ? (d.pickup_time || d.flight_arrival_time) : (d.flight_arrival_time || d.pickup_time);
    time = time || d.time;
  }
  return { date: vzfIso_(date), time: vzfClock_(time) };
}

// "27 nov." from "yyyy-MM-dd"; "" otherwise.
function vzfDay_(iso) {
  var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !VZF_MONTHS[Number(m[2]) - 1]) return "";
  return Number(m[3]) + " " + VZF_MONTHS[Number(m[2]) - 1];
}

function vzfNameKey_(name) {
  return String(name == null ? "" : name).toLowerCase().replace(/[éèê]/g, "e").replace(/[^a-z]/g, "");
}

// True for an empty name or the portal placeholder ("Invité", "Guest").
function vzfIsPlaceholderName_(name) {
  return VZF_PLACEHOLDER_NAMES.hasOwnProperty(vzfNameKey_(name));
}

// Full name of a stay (nom), else its first name (prenom). "" when unknown.
function vzfGuestName_(stay) {
  if (!stay) return "";
  var nom = String(stay.nom == null ? "" : stay.nom).replace(/^\s+|\s+$/g, "");
  var prenom = String(stay.prenom == null ? "" : stay.prenom).replace(/^\s+|\s+$/g, "");
  return nom || prenom;
}

function vzfFirstName_(stay) {
  if (!stay) return "";
  var prenom = String(stay.prenom == null ? "" : stay.prenom).replace(/^\s+|\s+$/g, "");
  if (prenom) return prenom;
  return vzfGuestName_(stay).split(/\s+/)[0] || "";
}

// date_confirmation (Date cell or "yyyy-MM-dd HH:mm") -> "yyyy-MM-dd HH:mm" | "yyyy-MM-dd" | "".
function vzfConfirmedAt_(value) {
  if (vzfIsDate_(value)) return vzfIso_(value) + " " + vzfClock_(value);
  var text = String(value == null ? "" : value);
  var day = vzfIso_(text);
  if (!day) return "";
  var m = text.match(/^\s*\d{4}-\d{2}-\d{2}[ T](\d{1,2}:\d{2})/);
  var clock = m ? vzfClock_(m[1]) : "";
  return clock ? day + " " + clock : day;
}

// "Confirmée le 25 nov. à 14:32" ("" when the date is unknown; no time rather than a wrong one).
function vzfConfirmedText_(value) {
  var at = vzfConfirmedAt_(value);
  if (!at) return "";
  var day = vzfDay_(at);
  if (!day) return "";
  var clock = at.length > 10 ? at.slice(11, 16) : "";
  return "Confirmée le " + day + (clock ? " à " + clock : "");
}

function vzfCanonStatus_(value) {
  var s = String(value || "").toLowerCase();
  if (s === "confirmée" || s === "confirmee") return "Confirmée";
  if (s === "terminée" || s === "terminee") return "Terminée";
  if (s === "annulée" || s === "annulee") return "Annulée";
  return "Envoyée";
}

// Confirmée becomes Terminée 2 h after the requested time (end of the day when there is no time).
function vzfPastGrace_(service, details, nowMs) {
  var when = vzfWhen_(service, details);
  if (!when.date) return false;
  var p = when.date.split("-");
  var t = when.time ? when.time.split(":") : ["0", "0"];
  var start = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(t[0]), Number(t[1]), 0, 0).getTime();
  var grace = when.time ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return nowMs >= start + grace;
}

function vzfShownStatus_(statut, service, details, nowMs) {
  var status = vzfCanonStatus_(statut);
  if (status === "Confirmée" && vzfPastGrace_(service, details, nowMs)) return "Terminée";
  return status;
}

// Service name for the guest and the Confirmer page.
function vzfServiceName_(service, details) {
  var d = details || {};
  var s = String(service || "");
  if (s === "restauration" || d.meal) {
    if (d.meal === "breakfast") return "Petit-déjeuner";
    if (d.meal === "dinner") return "Dîner";
    if (d.meal === "lunch") return "Déjeuner";
    return String(d.meal_label || "Repas");
  }
  if (s === "transfert" || d.flight_arrival_time !== undefined) return "Transfert aéroport";
  if (s === "course") return "Transfert en ville";
  if (s === "location_voiture" || d.car_type) return "Location";
  if (s === "massage" || d.soins) return "Massage";
  if (s === "activites" || d.activity) return d.activity === "quad" ? "Quad" : String(d.activity_label || "Activité");
  if (s === "menage") return "Ménage";
  if (s === "piscine") return "Piscine";
  return "Demande";
}

// One-line summary of a demande (Confirmer page). Service details only, no name, no price.
function vzfConfirmSummary_(service, details) {
  var d = details || {};
  var s = String(service || "");
  if (!s) {
    if (d.meal) s = "restauration";
    else if (d.trip_type === "arrival" || d.trip_type === "departure") s = "transfert";
    else if (d.car_type) s = "location_voiture";
    else if (d.soins) s = "massage";
    else if (d.destination) s = "course";
    else if (d.activity) s = "activites";
  }
  var when = vzfWhen_(s, d);
  var bits = [vzfServiceName_(s, d)];
  if (s === "location_voiture") {
    bits.push(d.car_type === "4x4" ? "4×4" : "Citadine");
    var start = (vzfDay_(when.date) + " " + when.time).replace(/^\s+|\s+$/g, "");
    var end = (vzfDay_(vzfIso_(d.end_date)) + " " + vzfClock_(d.return_time)).replace(/^\s+|\s+$/g, "");
    if (start || end) bits.push(start + (end ? " → " + end : ""));
    return bits.join(" · ");
  }
  if (s === "transfert") bits.push(d.trip_type === "departure" ? "départ" : "arrivée");
  if (when.date) bits.push(vzfDay_(when.date));
  if (when.time) bits.push(when.time);
  if (s === "course" && d.destination) bits.push(String(d.destination));
  var people = s === "transfert" || s === "course" ? d.passengers : (d.people || d.riders);
  if (people) bits.push(String(people) + " pers.");
  return bits.join(" · ");
}

function vzfFlag_(value, emptyIs) {
  if (value === "" || value == null) return !!emptyIs;
  var text = String(value).toLowerCase();
  return value === true || text === "true" || text === "oui" || text === "1" || text === "x";
}

function vzfHeat_(r, prefix) {
  if (r[prefix + "_jours"] === undefined && r[prefix + "_tarif_eur"] === undefined) return null;
  return {
    days: Number(r[prefix + "_jours"]) || 0,
    rate: Number(r[prefix + "_tarif_eur"]) || 0,
    offert: vzfFlag_(r[prefix + "_offert"], false)
  };
}

/* Children of a stay, 3 counters (v21): r = { enfants, enfants_4_11,
   enfants_moins_4, ages_enfants }. Old rows only have enfants + ages
   ("8,3"): under 4 -> moins_4, 4 to 11 -> de_4_a_11, 12 and over are
   counted as adults for meals (plus_12). Children without a known age
   are counted 4-11 (the safe guess for meals). */
function vzfStayKids_(r) {
  r = r || {};
  var n411 = r.enfants_4_11;
  var n4 = r.enfants_moins_4;
  var set = (n411 !== "" && n411 != null) || (n4 !== "" && n4 != null);
  if (set && (Number(n411) || Number(n4) || !Number(r.enfants))) {
    return { de_4_a_11: Number(n411) || 0, moins_4: Number(n4) || 0, plus_12: 0 };
  }
  var out = { de_4_a_11: 0, moins_4: 0, plus_12: 0 };
  var ages = String(r.ages_enfants == null ? "" : r.ages_enfants).split(",");
  var known = 0;
  for (var i = 0; i < ages.length; i++) {
    var text = ages[i].replace(/\s+/g, "");
    if (text === "" || isNaN(Number(text))) continue;
    var age = Number(text);
    known += 1;
    if (age < 4) out.moins_4 += 1;
    else if (age < 12) out.de_4_a_11 += 1;
    else out.plus_12 += 1;
  }
  var total = Number(r.enfants) || 0;
  if (total > known) out.de_4_a_11 += total - known;
  return out;
}

/* Children of a meal demande (details_json). v21 rows: enfants_4_11 /
   enfants_moins_4 counters. Older rows: children_ages object
   { plus_12, de_4_a_11, moins_4 } (still read). */
function vzfMealKids_(d) {
  d = d || {};
  if (d.enfants_4_11 != null || d.enfants_moins_4 != null) {
    return { de_4_a_11: Number(d.enfants_4_11) || 0, moins_4: Number(d.enfants_moins_4) || 0, plus_12: 0 };
  }
  var a = d.children_ages && typeof d.children_ages === "object" ? d.children_ages : {};
  return { de_4_a_11: Number(a.de_4_a_11) || 0, moins_4: Number(a.moins_4) || 0, plus_12: Number(a.plus_12) || 0 };
}

/* Breakfast extras (v21), French, for the admin and the guest:
   d.extras = { fruit_bowl: true, tajine_eggs: 2 } ->
   "Coupe de fruits frais · 2 œufs façon tajine". "" when none. */
function vzfExtrasText_(d) {
  var x = (d && d.extras) || {};
  var bits = [];
  if (x.fruit_bowl === true || String(x.fruit_bowl) === "true") bits.push("Coupe de fruits frais");
  var eggs = Number(x.tajine_eggs) || 0;
  if (eggs > 0) bits.push(eggs + (eggs > 1 ? " œufs façon tajine" : " œuf façon tajine"));
  return bits.join(" · ");
}

/* Public stay record for a valid guest link. r = one Réservations row as
   { header: value } (lowercase headers). Same keys for every stay, test
   rows included (they are reached only with their own key). */
function vzfPublicStay_(r) {
  r = r || {};
  var nom = String(r.nom == null ? "" : r.nom).replace(/^\s+|\s+$/g, "");
  var prenom = String(r.prenom == null ? "" : r.prenom).replace(/^\s+|\s+$/g, "") || nom.split(/\s+/)[0] || "";
  var offerts = String(r.offerts == null ? "" : r.offerts).split(",");
  var list = [];
  for (var i = 0; i < offerts.length; i++) if (offerts[i].replace(/\s+/g, "")) list.push(offerts[i].replace(/\s+/g, ""));
  var kids = vzfStayKids_(r);
  return {
    id: String(r.booking_id || r.id || ""),
    prenom: prenom,
    nom: nom,
    arrival: vzfIso_(r.date_arrivee || r.arrivee || r.check_in || r.arrival),
    departure: vzfIso_(r.date_depart || r.depart || r.check_out || r.departure),
    lien_actif: vzfFlag_(r.lien_actif, true),
    lien_expire_le: vzfIso_(r.lien_expire_le),
    pool: vzfHeat_(r, "chauffage_piscine"),
    jacuzzi: vzfHeat_(r, "chauffage_jacuzzi"),
    source: String(r.source || ""),
    adults: Number(r.adultes || r.adults) || 0,
    children: Number(r.enfants || r.children) || 0,
    children_4_11: kids.de_4_a_11,
    under_4: kids.moins_4,
    encaisse_total_eur: r.encaisse_total_eur === "" || r.encaisse_total_eur == null ? "" : Number(r.encaisse_total_eur) || 0,
    encaisse_mode: String(r.encaisse_mode || ""),
    encaisse_le: vzfIso_(r.encaisse_le),
    offerts: list
  };
}

/* Mes demandes item from one Demandes row:
   row = { id, date_creation, service, sous_type, nom_client, details, total, statut, date_confirmation, offert } */
function vzfListItem_(row, nowMs) {
  var d = row.details || {};
  var service = String(row.service || "");
  var when = vzfWhen_(service, d);
  var dish = d.dishes && d.dishes.length ? String(d.dishes[0].label || "") : "";
  return {
    id: String(row.id || ""),
    date_creation: String(row.date_creation || ""),
    service: service,
    sous_type: String(row.sous_type || ""),
    nom_client: vzfIsPlaceholderName_(row.nom_client) ? "" : String(row.nom_client),
    total: row.total === "" || row.total == null ? null : row.total,
    unit: service === "restauration" ? "eur" : "dh",
    status: vzfShownStatus_(row.statut, service, d, nowMs),
    offert: vzfFlag_(row.offert, false),
    when_date: when.date,
    when_time: when.time,
    date_confirmation: vzfConfirmedAt_(row.date_confirmation),
    meal: String(d.meal || ""),
    people: d.people || d.passengers || "",
    supplement: d.supplement || d.supplement_dh || 0,
    bill: String(d.bill_label || ""),
    dish: dish,
    activity: String(d.activity || ""),
    activity_label: String(d.activity_label || ""),
    scope: String(d.scope || ""),
    trip_type: String(d.trip_type || ""),
    destination: String(d.destination || ""),
    car_type: String(d.car_type || ""),
    adults: Number(d.adults) || 0,
    kids_4_11: vzfMealKids_(d).de_4_a_11,
    kids_under_4: vzfMealKids_(d).moins_4,
    extras: vzfExtrasText_(d)
  };
}
// END VZ_FIELDS

  var api = {
    MONTHS: VZF_MONTHS, STAY_FIELDS: VZF_STAY_FIELDS, ITEM_FIELDS: VZF_ITEM_FIELDS,
    iso: vzfIso_, clock: vzfClock_, when: vzfWhen_, day: vzfDay_,
    isPlaceholderName: vzfIsPlaceholderName_, guestName: vzfGuestName_, firstName: vzfFirstName_,
    confirmedAt: vzfConfirmedAt_, confirmedText: vzfConfirmedText_,
    canonStatus: vzfCanonStatus_, pastGrace: vzfPastGrace_, shownStatus: vzfShownStatus_,
    serviceName: vzfServiceName_, confirmSummary: vzfConfirmSummary_,
    publicStay: vzfPublicStay_, listItem: vzfListItem_,
    stayKids: vzfStayKids_, mealKids: vzfMealKids_, extrasText: vzfExtrasText_
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VZFields = api;
})(typeof window !== "undefined" ? window : this);
