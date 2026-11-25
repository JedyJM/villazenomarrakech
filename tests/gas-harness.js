// Minimal Apps Script sandbox for guest/apps-script/Code.gs (Node only).
// Loads the real file in a vm context with in-memory fakes for
// PropertiesService, CacheService, LockService, Utilities, SpreadsheetApp,
// ContentService, MailApp, UrlFetchApp. No network, no Google account.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const CODE = process.env.VZ_GAS_CODE || path.join(__dirname, "..", "guest", "apps-script", "Code.gs");

function signedBytes(buf) {
  return Array.from(buf, (b) => (b > 127 ? b - 256 : b));
}

class FakeRange {
  constructor(sheet, row, col, nr, nc) { Object.assign(this, { sheet, row, col, nr: nr || 1, nc: nc || 1 }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nr; r++) {
      const line = [];
      for (let c = 0; c < this.nc; c++) line.push(this.sheet.cell(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  getValue() { return this.sheet.cell(this.row, this.col); }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  setValues(vals) { vals.forEach((line, r) => line.forEach((v, c) => this.sheet.set(this.row + r, this.col + c, v))); return this; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
  insertCheckboxes() { return this; }
  setDataValidation() { return this; }
}

class FakeSheet {
  constructor(name, rows) { this.name = name; this.rows = (rows || []).map((r) => r.slice()); }
  cell(r, c) { const line = this.rows[r - 1]; return line && line[c - 1] !== undefined ? line[c - 1] : ""; }
  set(r, c, v) { while (this.rows.length < r) this.rows.push([]); const line = this.rows[r - 1]; while (line.length < c) line.push(""); line[c - 1] = v; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxRows() { return Math.max(this.rows.length, 100); }
  getRange(r, c, nr, nc) { return new FakeRange(this, r, c, nr, nc); }
  appendRow(values) { this.rows.push(values.slice()); }
  insertRowBefore(r) { this.rows.splice(r - 1, 0, []); }
  setFrozenRows() {}
  deleteRow(r) { this.rows.splice(r - 1, 1); }
}

function makeSandbox(opts) {
  opts = opts || {};
  const props = Object.assign({}, opts.props || {});
  const cache = {};
  const calls = { mail: 0, fetch: [], setProperty: 0 };
  const sheets = {};
  for (const [name, rows] of Object.entries(opts.sheets || {})) sheets[name] = new FakeSheet(name, rows);
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = new FakeSheet(n, [])),
  };
  const ctx = {
    console,
    JSON, Math, Date, String, Number, Object, Array, RegExp, isNaN, encodeURIComponent,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null),
        setProperty: (k, v) => { calls.setProperty++; props[k] = String(v); },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null),
        put: (k, v) => { cache[k] = String(v); },
        remove: (k) => { delete cache[k]; },
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }),
      getUserLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }),
    },
    Utilities: {
      Charset: { UTF_8: "UTF-8" },
      DigestAlgorithm: { SHA_256: "sha256" },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, value) => signedBytes(crypto.createHash("sha256").update(String(value), "utf8").digest()),
      computeHmacSha256Signature: (value, key) => signedBytes(crypto.createHmac("sha256", String(key)).update(String(value), "utf8").digest()),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => b & 0xff)).toString("base64url"),
      formatDate: (d, tz, fmt) => {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
        const get = (t) => parts.find((p) => p.type === t).value;
        return fmt.replace("yyyy", get("year")).replace("MM", get("month")).replace("dd", get("day")).replace("HH", get("hour")).replace("mm", get("minute")).replace("ss", get("second"));
      },
    },
    SpreadsheetApp: {
      openById: () => ss,
      newDataValidation: () => { const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({}) }; return b; },
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 1, DEFAULT: 0 },
      createHtmlOutput: (html) => ({ html, setTitle() { return this; }, setXFrameOptionsMode() { return this; } }),
    },
    MailApp: { sendEmail: () => { calls.mail++; } },
    UrlFetchApp: { fetch: (url, o) => { calls.fetch.push(url); return opts.fetch ? opts.fetch(url, o) : { getResponseCode: () => 500, getContentText: () => "{}" }; } },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(opts.source || fs.readFileSync(opts.code || CODE, "utf8"), ctx, { filename: "Code.gs" });
  if (opts.now) {
    // Freeze "today" for the date rules.
    const fixed = new Date(opts.now).getTime();
    vm.runInContext("Date = (function (Real) { function D(a, b, c, d, e, f, g) { if (!arguments.length) return new Real(" + fixed + "); return new (Function.prototype.bind.apply(Real, [null].concat([].slice.call(arguments))))(); } D.now = function () { return " + fixed + "; }; D.UTC = Real.UTC; D.parse = Real.parse; D.prototype = Real.prototype; return D; })(Date);", ctx);
  }
  return { ctx, props, cache, calls, sheets };
}

function out(res) {
  return JSON.parse(res.text);
}

module.exports = { makeSandbox, out, signedBytes };
