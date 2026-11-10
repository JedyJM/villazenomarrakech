(function () {
  "use strict";

  var cfg = window.VILLA_ZENO || {};
  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2);
  var isEn = lang === "en";

  function waLink() {
    var num = (cfg.whatsappNumber || "").replace(/[^\d]/g, "");
    var msg = isEn ? cfg.whatsappMessageEn : cfg.whatsappMessageFr;
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(msg || "");
  }

  function bookingLink() {
    return isEn ? (cfg.bookingUrlEn || cfg.bookingUrlFr) : (cfg.bookingUrlFr || cfg.bookingUrlEn);
  }

  function applyCtas() {
    document.querySelectorAll("[data-cta]").forEach(function (el) {
      var type = el.getAttribute("data-cta");
      if (type === "airbnb") el.href = cfg.airbnbUrl || el.href;
      if (type === "booking") el.href = bookingLink() || el.href;
      if (type === "whatsapp") el.href = waLink();
    });
  }

  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightbox-image");
  var lbCap = document.getElementById("lightbox-caption");
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-full]"));
  var index = 0;

  function show(i) {
    if (!items.length || !lb) return;
    index = (i + items.length) % items.length;
    var el = items[index];
    lbImg.src = el.getAttribute("data-full");
    lbImg.alt = el.getAttribute("alt") || "";
    if (lbCap) lbCap.textContent = el.getAttribute("data-caption") || el.getAttribute("alt") || "";
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = lb.querySelector(".lightbox-close");
    if (closeBtn) closeBtn.focus();
  }

  function hide() {
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
  }

  items.forEach(function (el, i) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      show(i);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show(i);
      }
    });
  });

  if (lb) {
    lb.querySelectorAll("[data-lb]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-lb");
        if (act === "close") hide();
        if (act === "prev") show(index - 1);
        if (act === "next") show(index + 1);
      });
    });
    lb.addEventListener("click", function (e) {
      if (e.target === lb) hide();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  if (lb) {
    var touchX = null;
    lb.addEventListener("touchstart", function (e) {
      if (e.changedTouches && e.changedTouches[0]) touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (touchX == null || !e.changedTouches || !e.changedTouches[0]) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 48) return;
      if (dx < 0) show(index + 1);
      else show(index - 1);
    }, { passive: true });
  }

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Service detail dialogs (transfers, activities, massage and dining)
  var serviceDialog = document.getElementById("service-dialog");
  if (serviceDialog) {
    var servicePanels = serviceDialog.querySelectorAll("[data-service-panel]");
    var serviceClose = serviceDialog.querySelector(".service-dialog-close");
    var lastServiceTrigger = null;

    function closeServiceDialog() {
      if (typeof serviceDialog.close === "function" && serviceDialog.open) {
        serviceDialog.close();
      } else {
        serviceDialog.removeAttribute("open");
      }
    }

    document.addEventListener("click", function (e) {
      var trigger = e.target.closest(".svc-detail-trigger[data-service-dialog]");
      if (!trigger || !serviceDialog.contains(trigger) && trigger.closest("#services") == null) return;
      var panelName = trigger.getAttribute("data-service-dialog");
      var targetPanel = serviceDialog.querySelector('[data-service-panel="' + panelName + '"]');
      if (!targetPanel) return;

      e.preventDefault();
      lastServiceTrigger = trigger;
      servicePanels.forEach(function (panel) {
        panel.hidden = panel !== targetPanel;
      });

      if (typeof serviceDialog.showModal === "function") {
        if (!serviceDialog.open) serviceDialog.showModal();
      } else {
        serviceDialog.setAttribute("open", "open");
      }
      if (serviceClose) serviceClose.focus();
    });

    if (serviceClose) serviceClose.addEventListener("click", closeServiceDialog);
    serviceDialog.addEventListener("click", function (e) {
      if (e.target === serviceDialog) closeServiceDialog();
    });
    serviceDialog.addEventListener("close", function () {
      if (lastServiceTrigger) lastServiceTrigger.focus();
    });
  }

  applyCtas();

  var faqBtn = document.querySelector(".faq-toggle");
  if (faqBtn) {
    var more = document.getElementById(faqBtn.getAttribute("aria-controls"));
    faqBtn.addEventListener("click", function () {
      var open = faqBtn.getAttribute("aria-expanded") === "true";
      faqBtn.setAttribute("aria-expanded", open ? "false" : "true");
      if (more) more.hidden = open;
      faqBtn.textContent = open
        ? faqBtn.getAttribute("data-label-more")
        : faqBtn.getAttribute("data-label-less");
    });
  }

  function setupReviewToggles() {
    document.querySelectorAll(".review-card").forEach(function (card) {
      var text = card.querySelector(".review-text");
      var btn = card.querySelector(".review-more");
      if (!text || !btn) return;
      if (btn.getAttribute("aria-expanded") !== "true") {
        text.classList.add("is-clamped");
        var overflow = text.scrollHeight > text.clientHeight + 2;
        text.classList.toggle("is-clamped", overflow);
        btn.hidden = !overflow;
      }
      if (btn.getAttribute("data-ready") === "1") return;
      btn.setAttribute("data-ready", "1");
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        text.classList.toggle("is-clamped", open);
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        btn.textContent = open ? btn.getAttribute("data-more") : btn.getAttribute("data-less");
      });
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setupReviewToggles);
  }
  window.addEventListener("load", setupReviewToggles);
  setupReviewToggles();
})();
