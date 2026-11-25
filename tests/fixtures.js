// Shared fixtures for the Code.gs tests (not a test file).
"use strict";
const crypto = require("node:crypto");
const { makeSandbox, out } = require("./gas-harness");

const SECRET = "test-secret-not-real-0123456789abcdef";
const RES_HEADERS = ["booking_id", "nom", "date_arrivee", "date_depart", "bien", "origine", "lien_actif", "lien_expire_le", "adultes"];
const DEM_HEADERS = ["id", "date_creation", "service", "sous_type", "nom_client", "details_json", "total_dh", "destinataire", "statut", "date_confirmation", "offert"];

function keyOf(id, secret) {
  return crypto.createHmac("sha256", secret || SECRET).update(id, "utf8").digest("hex").slice(0, 16);
}

function sandbox(extra) {
  extra = extra || {};
  const box = makeSandbox({
    now: extra.now || "2026-11-25T10:00:00Z",
    props: Object.assign({ LINK_SECRET: SECRET }, extra.props || {}),
    sheets: {
      "Réservations": [RES_HEADERS].concat(extra.stays || [
        ["FAM-SK-2611", "Samiya Kabbaj", "2026-11-27", "2026-12-02", "Villa Zen'O", "gmail", true, "", 2],
        ["HMABC123", "Jean Dupont", "2026-11-20", "2026-11-28", "", "gmail", "", "", 2],
        ["OTHER1", "Autre Bien", "2026-11-20", "2026-11-28", "M avenue", "gmail", "", "", 2],
        ["tst0000001", "Test Row", "2026-11-20", "2026-11-28", "", "test", "", "", 2],
      ]),
      Demandes: [DEM_HEADERS,
        ["d1", "2026-11-24T10:00:00Z", "menage", "maison", "Invité", JSON.stringify({ booking_id: "HMABC123", token: "tok1234567", date: "2026-11-26" }), "", "Nadera", "Envoyée", "", false],
        ["d2", "2026-11-24T10:00:00Z", "menage", "maison", "Invité", JSON.stringify({ booking_id: "FAM-SK-2611", token: "tok7654321" }), "", "Nadera", "Envoyée", "", false],
      ],
    },
  });
  box.wa = 0;
  box.ctx.waNotifyStaff_ = () => { box.wa++; };
  box.ctx.notifyNewDemande_ = () => { box.mail = (box.mail || 0) + 1; };
  return box;
}

function list(box, stay, k) {
  const p = { action: "list" };
  if (stay != null) p.stay = stay;
  if (k != null) p.k = k;
  return out(box.ctx.doGet({ parameter: p }));
}
function post(box, body) {
  return out(box.ctx.doPost({ postData: { contents: JSON.stringify(body) } }));
}
const NEUTRAL = { ok: false, error: "invalid_link" };

function demande(extra) {
  return Object.assign({
    id: "n" + Math.random().toString(36).slice(2, 9), token: "abcdefghij", service: "menage", sous_type: "maison",
    nom_client: "Invité", details: { booking_id: "HMABC123", date: "2026-11-26" }, total_dh: "", destinataire: "Nadera",
  }, extra);
}

module.exports = { sandbox, keyOf, list, post, demande, NEUTRAL, SECRET };
