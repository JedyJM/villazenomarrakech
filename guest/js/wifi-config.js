/* Single place for the villa Wi-Fi. The public site does not publish these values.
   Replace network and password here only. The page and the printable QR both read them. */
(function (root) {
  "use strict";

  var wifi = {
    network: "HUAWEI-5G-c5Pv",
    password: "10203040"
  };

  function esc(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/([;,:"])/g, "\\$1");
  }

  var api = {
    wifi: wifi,
    wifiPayload: function () {
      return "WIFI:T:WPA;S:" + esc(wifi.network) + ";P:" + esc(wifi.password) + ";;";
    }
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  root.GUEST_PORTAL = api;
})(typeof window !== "undefined" ? window : globalThis);
