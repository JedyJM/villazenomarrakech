/* Nouvelle dépense or an edit. French. Test mode keeps the writing in localStorage. */
(function () {
  "use strict";

  var stats = window.AdminStats;
  var shell = window.AdminShell || { TEST_MODE: true, SCRIPT_URL: "", session: function () { return ""; } };
  var calc = window.AdminCalc;
  var CATS = [
    ["salaires", "Salaires"],
    ["citerne", "Citerne"],
    ["jardinier", "Jardinier"],
    ["menage", "Ménage supp."],
    ["ordures", "Ordures"],
    ["courses", "Courses"],
    ["fournitures", "Fournitures"],
    ["reparations", "Réparations"]
  ];
  var model = { id: "", amount: "", devise: "dh", categorie: "", detail: "", date: "", fournisseur: "", facture_url: "", facture_nom: "" };

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function query(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function today() {
    return stats && stats.todayIso ? stats.todayIso() : "2026-12-16";
  }
  function find(id) {
    var found = null;
    (stats && stats.all ? stats.all() : []).forEach(function (item) { if (item.id === id) found = item; });
    return found;
  }
  function face(iso) {
    return calc ? calc.dayText(iso, true) : iso;
  }
  function paint() {
    var root = document.querySelector("[data-depense]");
    var editing = !!model.id;
    var detail = model.categorie === "reparations"
      ? '<label class="field">Détail<input name="detail" value="' + esc(model.detail) + '" placeholder="plombier, électricien…"></label>'
      : "";
    var photo = model.facture_url
      ? '<span class="shot"><img alt="" src="' + esc(model.facture_url) + '"><em>' + esc(model.facture_nom || "facture.jpg") + "</em></span>"
      : '<span class="shot is-empty"><em>Ajouter une photo</em><small>Appareil ou fichier</small></span>';
    root.innerHTML = '<a class="back" href="stats.html?vue=depenses">‹ Dépenses</a>'
      + "<h1>" + (editing ? "Modifier la dépense" : "Nouvelle dépense") + "</h1>"
      + '<form class="expense-form">'
      + '<label class="field">Montant<input name="amount" inputmode="decimal" value="' + esc(model.amount) + '" placeholder="0"></label>'
      + '<div class="segment" role="group" aria-label="Devise">'
      + '<button type="button" data-devise="dh" aria-pressed="' + (model.devise === "dh" ? "true" : "false") + '">DH</button>'
      + '<button type="button" data-devise="eur" aria-pressed="' + (model.devise === "eur" ? "true" : "false") + '">€</button>'
      + "</div>"
      + '<p class="kicker">Catégorie</p><div class="cat-picks">' + CATS.map(function (cat) {
        var on = model.categorie === cat[0];
        return '<button type="button" data-cat="' + cat[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(cat[1]) + "</button>";
      }).join("") + "</div>"
      + detail
      + '<div class="field-pair"><label class="field">Date<span class="date-fr"><input type="date" lang="fr" name="date" value="' + esc(model.date) + '"><span class="date-face">' + esc(face(model.date)) + "</span></span></label>"
      + '<label class="field">Fournisseur<input name="fournisseur" value="' + esc(model.fournisseur) + '" placeholder="Facultatif"></label></div>'
      + '<p class="kicker">Photo de la facture</p><label class="photo-card">' + photo + '<input type="file" accept="image/*" capture="environment" data-file></label>'
      + '<p class="form-error" data-error></p>'
      + '<button type="submit" class="primary">Enregistrer la dépense</button>'
      + (editing ? '<button type="button" class="ghost" data-delete>Supprimer</button>' : "")
      + "</form>";
    var date = root.querySelector("[name=date]");
    if (date) date.addEventListener("change", function () {
      model.date = date.value;
      var span = root.querySelector(".date-face");
      if (span) span.textContent = face(model.date);
    });
  }
  function readForm() {
    var root = document.querySelector("[data-depense]");
    model.amount = root.querySelector("[name=amount]").value;
    model.detail = (root.querySelector("[name=detail]") || {}).value || "";
    model.date = root.querySelector("[name=date]").value;
    model.fournisseur = root.querySelector("[name=fournisseur]").value;
  }
  function amountCents() {
    var text = String(model.amount || "").replace(/\s|\u00A0/g, "").replace(",", ".");
    var n = Number(text);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }
  function save() {
    readForm();
    var error = document.querySelector("[data-error]");
    if (!amountCents()) { error.textContent = "Indiquez un montant."; return; }
    if (!model.categorie) { error.textContent = "Choisissez une catégorie."; return; }
    if (!model.date) { error.textContent = "Indiquez la date."; return; }
    var cents = amountCents();
    var eur = model.devise === "eur" ? cents : Math.round(cents / stats.RATE);
    var dh = model.devise === "dh" ? cents : cents * stats.RATE;
    var record = {
      id: model.id || ("x" + Date.now().toString(36)),
      date: model.date,
      categorie: model.categorie,
      detail: model.categorie === "reparations" ? model.detail : "",
      fournisseur: model.fournisseur,
      montant_eur: eur / 100,
      montant_dh: dh / 100,
      devise_saisie: model.devise,
      facture_url: model.facture_url,
      facture_nom: model.facture_nom,
      cree_le: model.date
    };
    var bag = stats.readExtra();
    bag.items = (bag.items || []).filter(function (item) { return item.id !== record.id; });
    bag.items.push(record);
    stats.saveExtra(bag);
    if (shell.invalidate) shell.invalidate("depenses");
    writeThen({
      action: "save-depense",
      depense: record,
      facture_base64: model.facture_url && model.facture_url.indexOf("base64,") > 0 ? model.facture_url : "",
      facture_nom: model.facture_nom
    });
  }
  /* Awaited write (shared client): back to Stats only after ok:true;
     otherwise the error stays on the page with « Réessayer ». */
  function writeThen(body) {
    var root = document.querySelector("[data-depense]");
    var note = root && root.querySelector("[data-depense-error]");
    if (root && !note) {
      note = document.createElement("p");
      note.className = "form-error";
      note.setAttribute("data-depense-error", "");
      note.setAttribute("role", "alert");
      root.appendChild(note);
    }
    if (note) { note.hidden = false; note.textContent = "Enregistrement…"; }
    shell.api.post(body).then(function (result) {
      if (result.ok) { window.location.href = "stats.html?vue=depenses"; return; }
      if (note) shell.showError(note, result, function () { writeThen(body); }, "save");
    });
  }
  function remove() {
    var bag = stats.readExtra();
    bag.gone = bag.gone || [];
    if (bag.gone.indexOf(model.id) < 0) bag.gone.push(model.id);
    bag.items = (bag.items || []).filter(function (item) { return item.id !== model.id; });
    stats.saveExtra(bag);
    if (shell.invalidate) shell.invalidate("depenses");
    writeThen({ action: "delete-depense", id: model.id });
  }
  function boot() {
    var root = document.querySelector("[data-depense]");
    if (!root || document.body.classList.contains("is-locked") || !stats) return;
    var existing = find(query("id"));
    if (existing) {
      var dh = existing.devise_saisie === "dh";
      model.id = existing.id;
      model.amount = String(dh ? existing.montant_dh : existing.montant_eur).replace(".", ",");
      model.devise = dh ? "dh" : "eur";
      model.categorie = existing.categorie;
      model.detail = existing.detail || "";
      model.date = existing.date;
      model.fournisseur = existing.fournisseur || "";
      model.facture_url = existing.facture_url || "";
      model.facture_nom = existing.facture_nom || "";
    } else {
      var mois = query("mois");
      model.date = mois ? mois + "-16" : today();
    }
    root.addEventListener("click", function (event) {
      var devise = event.target.closest("[data-devise]");
      if (devise) { readForm(); model.devise = devise.getAttribute("data-devise"); paint(); return; }
      var cat = event.target.closest("[data-cat]");
      if (cat) { readForm(); model.categorie = cat.getAttribute("data-cat"); paint(); return; }
      if (event.target.closest("[data-delete]")) {
        document.querySelector("[data-del]").hidden = false;
        document.querySelector("[data-del-back]").hidden = false;
      }
    });
    root.addEventListener("change", function (event) {
      var input = event.target.closest("[data-file]");
      if (!input || !input.files || !input.files[0]) return;
      var file = input.files[0];
      var reader = new FileReader();
      reader.onload = function () {
        readForm();
        model.facture_url = String(reader.result || "");
        model.facture_nom = file.name;
        paint();
      };
      reader.readAsDataURL(file);
    });
    root.addEventListener("submit", function (event) {
      event.preventDefault();
      save();
    });
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-del-yes]")) remove();
      else if (event.target.closest("[data-del-no]") || event.target.hasAttribute("data-del-back")) {
        document.querySelector("[data-del]").hidden = true;
        document.querySelector("[data-del-back]").hidden = true;
      }
    });
    paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
