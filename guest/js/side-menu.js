/* French guest menu. Mes demandes and Accès à la villa. */
(function () {
  "use strict";
  if ((document.documentElement.lang || "fr").slice(0, 2) !== "fr") return;
  if (document.querySelector("[data-open-menu]")) return;

  var header = document.querySelector(".header-inner");
  if (!header) return;
  var lang = header.querySelector(".lang-switch");
  var tools = document.createElement("div");
  tools.className = "header-tools";
  tools.innerHTML = '<button type="button" class="menu-btn" data-open-menu aria-expanded="false" aria-controls="guest-menu" aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h10"/></svg></button>';
  if (lang) tools.appendChild(lang);
  header.appendChild(tools);

  document.body.insertAdjacentHTML("beforeend",
    '<dialog class="side-menu" id="guest-menu" aria-labelledby="guest-menu-title">' +
    '<div class="side-card">' +
    '<div class="side-head"><h2 id="guest-menu-title" tabindex="-1">Menu</h2><button type="button" class="sheet-close" data-menu-close>Fermer</button></div>' +
    '<nav class="side-links" aria-label="Menu">' +
    '<a href="demandes.html"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="7" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="5" cy="17" r="1.3"/><path d="M9 7h10M9 12h10M9 17h10"/></svg><span>Mes demandes</span></a>' +
    '<a href="acces.html"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg><span>Accès à la villa</span></a>' +
    '</nav></div></dialog>'
  );

  var menu = document.getElementById("guest-menu");
  var openers = document.querySelectorAll("[data-open-menu]");
  function setOpen(on) {
    openers.forEach(function (button) { button.setAttribute("aria-expanded", on ? "true" : "false"); });
  }
  openers.forEach(function (button) {
    button.addEventListener("click", function () {
      if (menu && typeof menu.showModal === "function") {
        menu.showModal();
        var title = menu.querySelector("h2");
        if (title) title.focus();
      }
      setOpen(true);
    });
  });
  if (!menu) return;
  menu.querySelectorAll("[data-menu-close]").forEach(function (button) {
    button.addEventListener("click", function () { menu.close(); });
  });
  menu.addEventListener("click", function (event) {
    if (event.target === menu) menu.close();
  });
  menu.addEventListener("close", function () { setOpen(false); });
})();
