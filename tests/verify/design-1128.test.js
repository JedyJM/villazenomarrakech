// Nouveau design invité 2026-11-28 (pages au système « Pisé & Palmeraie ») — contrôles statiques, sans navigateur.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const NB = " ";
const strip = (s) => s.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");

// Aucun secret nouveau sur une page du nouveau design : ni numéro WhatsApp, ni URL Apps Script, ni identifiant.
function noSecret(name, html) {
  assert.doesNotMatch(html, /script\.google\.com|\/exec\b/, name + ": URL Apps Script");
  assert.doesNotMatch(html, /wa\.me\/|\+?212[\s\d]{9,}/, name + ": numéro écrit en dur");
  assert.doesNotMatch(html, /netflix|prime video|mot de passe|password|token=|[?&]k=/i, name + ": identifiant");
  assert.doesNotMatch(html, /portal\.css|fonts\.googleapis|Inter:|Playfair/, name + ": ancien design");
}

test("La Villa v2h : en-tête, dix sections dans l'ordre, pictos copiés tels quels", () => {
  const html = read("guest/villa.html");
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<title>La Villa \| Villa Zen’O<\/title>/);
  assert.match(html, /<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">/);
  assert.match(html, /<a class="back" href="\.\/" aria-label="Accueil">/);
  assert.match(html, /<h1 class="h1 one" data-one>La Villa<\/h1>/);
  assert.match(html, /Tout ce qu’il faut savoir pour votre séjour\./);
  const secs = [...html.matchAll(/<details data-sec="([a-z]+)"><summary><span class="sum-ico">([\s\S]*?)<\/span><h2 data-one>([^<]+)<\/h2>/g)];
  assert.deepEqual(secs.map((m) => [m[1], m[3].replace(/&amp;/g, "&")]), [
    ["bienvenue", "Bienvenue chez vous"], ["equipe", "L’équipe"], ["services", "Services inclus"], ["repas", "Repas & courses"],
    ["famille", "En famille"], ["quotidien", "Au quotidien"], ["cles", "Clés, badges & coffre"], ["visiteurs", "Visiteurs"],
    ["vie", "Vie à la villa"], ["depart", "Votre départ"]]);
  const files = ["bienvenue", "equipe", "services", "restauration", "famille", "toute-la-maison", "cles", "visiteurs", "la-villa", "depart"];
  secs.forEach((m, i) => {
    const svg = read("guest/systeme/pictos/plume/" + files[i] + ".svg").replace("<svg ", '<svg class="plume" aria-hidden="true" ');
    assert.equal(m[2].trim(), svg.trim(), files[i] + ".svg intégré à l'identique");
  });
  assert.equal((html.match(/class="chev" aria-hidden="true"/g) || []).length, 10);
  assert.doesNotMatch(html, /<details[^>]* open/, "liste fermée au chargement");
});

test("La Villa v2h : textes clés mot pour mot, montants validés, pas de Wi-Fi ni de toilettes", () => {
  const html = read("guest/villa.html");
  const t = strip(html);
  for (const s of [
    "Arrivée à partir de 15" + NB + "h.", "Chaque jour, de 9" + NB + "h 30 à 17" + NB + "h.", "Sécurité 24" + NB + "h/24",
    "Service : 9" + NB + "h–12" + NB + "h, 12" + NB + "h–16" + NB + "h et 19" + NB + "h–21" + NB + "h.",
    "Courses : 100" + NB + "MAD par livraison. Nous ne livrons pas d’alcool.",
    "une participation de 50" + NB + "€ vous serait demandée.", "une participation de 120" + NB + "€ vous sera alors demandée.",
    "Seules les personnes enregistrées à la réservation sont autorisées à accéder à la villa. Les visiteurs extérieurs non prévus ne sont pas autorisés, sauf accord du propriétaire.",
    "adressez-vous à l’équipe, ou à Mehdi ou Jalil.",
    "Nous espérons que vous aurez passé un\nmerveilleux" + NB + "séjour.", "Le départ est prévu à 11" + NB + "h.",
    "Un départ tardif est possible\nuniquement après" + NB + "confirmation,\nselon le calendrier\net les prochaines" + NB + "arrivées.",
    "Avant de quitter la maison", "Convenez de l’heure avec l’équipe.", "Rendez clés et badges.", "Vérifiez affaires, chargeurs, coffre.", "Réglez les prestations en plus.",
  ]) assert.ok(t.includes(s), "texte : " + s);
  assert.match(html, /<b>Entre minuit et 8 h : pas de musique forte ni de fête\.<\/b>/);
  assert.match(html, /<p class="closing">Merci de nous aider à préserver la tranquillité de la villa et de son environnement\.<\/p>/);
  assert.deepEqual([...html.matchAll(/<div class="part"><h3 data-one>([^<]+)<\/h3>/g)].map((m) => m[1]), ["Rideaux", "Assises", "Climatisation", "Décoration", "Salles d’eau"]);
  assert.equal((html.match(/<span data-check data-one>/g) || []).length, 4);
  assert.doesNotMatch(t, /toilettes|Wi-Fi|\bDH\b|baby-foot|ping-pong/i);
  assert.equal((t.match(/50 €/g) || []).length, 1, "50 € : rideaux seulement");
});

test("La Villa v2h : accordéon (une seule section, place()), barre du shell, aucun secret", () => {
  const html = read("guest/villa.html");
  assert.match(html, /function place\(el\)/);
  assert.match(html, /all\.forEach\(function\(o\)\{if\(o!==item\)o\.open=false;\}\)/);
  assert.match(html, /requestAnimationFrame\(function\(\)\{place\(item\);\}\)/);
  assert.match(html, /<script src="js\/guest-shell\.js\?v=[0-9a-z]+" data-home="\.\/" data-variant="systeme"><\/script>/);
  for (const s of ["config.js", "portal.js", "guest-stay.js", "requests.js"]) assert.ok(html.includes(s), "script conservé : " + s);
  noSecret("guest/villa.html", html.replace(/<svg[\s\S]*?<\/svg>/g, ""));
  const shell = read("guest/js/guest-shell.js");
  const nav = JSON.parse(shell.match(/var GUEST_NAV_SYSTEME = (".*");/)[1]);
  const items = [...nav.matchAll(/<(a|button)([^>]*)>[\s\S]*?<span>([^<]+)<\/span><\/\1>/g)].map((m) => [m[3], (m[2].match(/aria-label="([^"]+)"/) || [])[1]]);
  assert.deepEqual(items, [["Accueil", "Accueil"], ["Demandes", "Mes demandes"], ["Accès", "Accès"], ["Contacts", "Contacts utiles"], ["Mehdi", "Écrire à Mehdi, votre hôte, sur WhatsApp"]]);
  assert.match(nav, /href="demandes\.html"/); assert.match(nav, /href="acces\.html"/); assert.match(nav, /data-open-contacts/); assert.match(nav, /data-guest-whatsapp/);
  assert.doesNotMatch(nav, /wa\.me|212/, "numéro de Mehdi : peint par portal.js, pas écrit dans la barre");
});

test("Système commun : jetons et polices locales présents", () => {
  const css = read("guest/systeme/systeme.css");
  for (const tok of ["--chaux:#F5EFE6", "--lin:#FBF8F3", "--sable:#E4D8C6", "--pise:#9C4F33", "--palmeraie:#2F3B2F", "--encre:#231F1B", "--taupe:#73685D"]) assert.ok(css.includes(tok), tok);
  for (const f of ["Cardo-Regular.ttf", "Cardo-Italic.ttf", "DMSans-var.ttf"]) assert.ok(fs.statSync(path.join(root, "guest/systeme/fonts", f)).size > 10000, f);
});
