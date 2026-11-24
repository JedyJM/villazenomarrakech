/* Shared admin data hooks. Real data only: no demo stays, no demo
   requests. Pages fetch the Sheet themselves; these stay empty. */
(function () {
  "use strict";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  function requests() { return []; }
  function stays() { return { current: null, next: null, past: null }; }

  window.AdminSample = { today: today, requests: requests, stays: stays, pad: pad };
})();
