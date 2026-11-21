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
    '<div class="side-head"><a class="logo" id="guest-menu-title" href="./">Villa Zen’O<small>Marrakech Palmeraie</small></a><button type="button" class="menu-x" data-menu-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button></div>' +
    '<nav class="side-links" aria-label="Menu">' +
    '<a href="./"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"/><path d="M7 10.5V19h10v-8.5"/></svg><span>Accueil</span></a>' +
    '<button type="button" data-menu-contacts><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3l1.2 3-2 1.2a12 12 0 0 0 5.6 5.6L17 13l3 1.2V17a2 2 0 0 1-2 2A14 14 0 0 1 5 7a2 2 0 0 1 2-2z"/></svg><span>Contacts utiles</span></button>' +
    '<a href="demandes.html"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/><path d="M9 7h10M9 12h10M9 17h10"/></svg><span>Mes demandes</span></a>' +
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
  var contacts = menu.querySelector("[data-menu-contacts]");
  if (contacts) {
    contacts.addEventListener("click", function () {
      menu.close();
      var button = document.querySelector("[data-open-contacts]");
      if (button) button.click();
    });
  }
})();
