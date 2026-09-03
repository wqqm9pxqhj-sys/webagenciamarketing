/*
 * Gestor de consentimiento de cookies — AXIONA Systems.
 * Vanilla JS, sin dependencias. No carga nada por sí mismo: solo activa
 * scripts marcados como type="text/plain" data-categoria="..." una vez
 * hay consentimiento explícito para esa categoría.
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'axiona_consent';
  var CONSENT_VERSION = '1.0';
  var MAX_AGE_DAYS = 730; // 24 meses

  // ---------- cookie helpers ----------
  function setCookie(name, value, days) {
    var expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    var secure = location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/;SameSite=Lax' + secure;
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function readConsent() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (data.version !== CONSENT_VERSION) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeConsent(categories) {
    var data = {
      necesarias: true,
      analiticas: !!categories.analiticas,
      marketing: !!categories.marketing,
      fecha: new Date().toISOString(),
      version: CONSENT_VERSION
    };
    setCookie(COOKIE_NAME, JSON.stringify(data), MAX_AGE_DAYS);
    return data;
  }

  // Activa los scripts de terceros correspondientes a las categorías consentidas.
  // Los scripts bloqueados deben marcarse en el HTML como:
  //   <script type="text/plain" data-categoria="analiticas" data-src="...">...</script>
  // Mientras no haya consentimiento para esa categoría, el navegador nunca
  // los ejecuta (type="text/plain" no es un tipo ejecutable).
  function activateScripts(consent) {
    var scripts = document.querySelectorAll('script[type="text/plain"][data-categoria]');
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
      var cat = old.getAttribute('data-categoria');
      if (cat === 'necesarias' || consent[cat]) {
        var fresh = document.createElement('script');
        for (var j = 0; j < old.attributes.length; j++) {
          var attr = old.attributes[j];
          if (attr.name !== 'type') fresh.setAttribute(attr.name, attr.value);
        }
        fresh.type = 'text/javascript';
        if (old.getAttribute('data-src')) fresh.src = old.getAttribute('data-src');
        fresh.text = old.text;
        old.parentNode.replaceChild(fresh, old);
      }
    }
  }

  // ---------- UI ----------
  var banner, modalBackdrop, modal, toggleAnaliticas, toggleMarketing;
  var returnFocusEl = null;
  var bannerWasOpen = false;

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function buildUI() {
    banner = el(
      '<div class="cookie-banner" id="cookieBanner" role="dialog" aria-modal="true" aria-labelledby="cookieBannerTitle" hidden>' +
        '<div class="cookie-banner-inner">' +
          '<div class="cookie-banner-text">' +
            '<h2 id="cookieBannerTitle" class="visually-hidden">Uso de cookies</h2>' +
            '<p>Usamos cookies propias necesarias para el funcionamiento del sitio. Con tu permiso, también podríamos usar cookies analíticas y de marketing. Puedes aceptarlas, rechazarlas o elegir cuáles en <a href="/politica-cookies">nuestra política de cookies</a>.</p>' +
          '</div>' +
          '<div class="cookie-banner-actions">' +
            '<button type="button" class="btn-cookie btn-cookie-reject" data-action="reject">Rechazar todas</button>' +
            '<button type="button" class="btn-cookie btn-cookie-config" data-action="configure">Configurar</button>' +
            '<button type="button" class="btn-cookie btn-cookie-accept" data-action="accept">Aceptar todas</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    modalBackdrop = el(
      '<div class="cookie-modal-backdrop" id="cookieModalBackdrop" hidden>' +
        '<div class="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookieModalTitle">' +
          '<button type="button" class="cookie-modal-close" data-action="close-modal" aria-label="Cerrar preferencias de cookies">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
          '<h2 id="cookieModalTitle">Preferencias de cookies</h2>' +
          '<p>Elige qué categorías de cookies aceptas. Las necesarias no se pueden desactivar porque el sitio no funcionaría sin ellas. Más detalle en <a href="/politica-cookies">la política de cookies</a>.</p>' +
          '<div class="cookie-category">' +
            '<div class="cookie-category-head">' +
              '<h3>Necesarias</h3>' +
              '<span class="cookie-locked">Siempre activas</span>' +
            '</div>' +
            '<p>Imprescindibles para que la web funcione: recuerdan tu elección de cookies y mantienen la seguridad del sitio. No se pueden desactivar.</p>' +
          '</div>' +
          '<div class="cookie-category">' +
            '<div class="cookie-category-head">' +
              '<h3><label for="cookieToggleAnaliticas">Analíticas</label></h3>' +
              '<span class="cookie-switch"><input type="checkbox" id="cookieToggleAnaliticas" /><span class="track"></span><span class="thumb"></span></span>' +
            '</div>' +
            '<p>Nos ayudarían a entender cómo se usa la web para mejorarla. Ahora mismo el sitio no tiene ninguna cookie analítica activa; si activas esta categoría, se usará en cuanto instalemos alguna herramienta de medición.</p>' +
          '</div>' +
          '<div class="cookie-category">' +
            '<div class="cookie-category-head">' +
              '<h3><label for="cookieToggleMarketing">Marketing</label></h3>' +
              '<span class="cookie-switch"><input type="checkbox" id="cookieToggleMarketing" /><span class="track"></span><span class="thumb"></span></span>' +
            '</div>' +
            '<p>Se usarían para mostrar publicidad relevante o medir campañas. Ahora mismo el sitio no tiene ninguna cookie de marketing activa.</p>' +
          '</div>' +
          '<div class="cookie-modal-actions">' +
            '<button type="button" class="btn-cookie btn-cookie-reject" data-action="reject">Rechazar todas</button>' +
            '<button type="button" class="btn-cookie btn-cookie-config" data-action="save">Guardar selección</button>' +
            '<button type="button" class="btn-cookie btn-cookie-accept" data-action="accept">Aceptar todas</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    document.body.appendChild(banner);
    document.body.appendChild(modalBackdrop);
    modal = modalBackdrop.querySelector('.cookie-modal');
    toggleAnaliticas = modalBackdrop.querySelector('#cookieToggleAnaliticas');
    toggleMarketing = modalBackdrop.querySelector('#cookieToggleMarketing');

    banner.addEventListener('click', onAction);
    modalBackdrop.addEventListener('click', function (e) {
      if (e.target === modalBackdrop) return; // backdrop click: no cerramos por accidente una decisión pendiente
      onAction(e);
    });
    banner.addEventListener('keydown', function (e) { onKeydown(e, banner); });
    modalBackdrop.addEventListener('keydown', function (e) { onKeydown(e, modal); });
  }

  function onAction(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'accept') {
      finish(writeConsent({ analiticas: true, marketing: true }));
    } else if (action === 'reject') {
      finish(writeConsent({ analiticas: false, marketing: false }));
    } else if (action === 'configure') {
      openModal(true);
    } else if (action === 'save') {
      finish(writeConsent({ analiticas: toggleAnaliticas.checked, marketing: toggleMarketing.checked }));
    } else if (action === 'close-modal') {
      closeModal();
    }
  }

  function onKeydown(e, container) {
    if (e.key === 'Tab') {
      trapFocus(container, e);
    } else if (e.key === 'Escape') {
      if (container === modal) {
        e.preventDefault();
        closeModal();
      }
      // El aviso principal no se cierra con Escape sin una decisión explícita.
    }
  }

  function trapFocus(container, e) {
    var focusables = container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openBanner() {
    banner.hidden = false;
    bannerWasOpen = true;
    var firstBtn = banner.querySelector('[data-action]');
    if (firstBtn) firstBtn.focus();
  }

  function closeBanner() {
    banner.hidden = true;
  }

  function openModal(fromBanner) {
    var consent = readConsent();
    toggleAnaliticas.checked = consent ? !!consent.analiticas : false;
    toggleMarketing.checked = consent ? !!consent.marketing : false;
    returnFocusEl = document.activeElement;
    bannerWasOpen = !banner.hidden;
    if (fromBanner) banner.hidden = true;
    modalBackdrop.hidden = false;
    modal.querySelector('.cookie-modal-close').focus();
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    var consent = readConsent();
    if (!consent && bannerWasOpen) {
      // Seguía sin haber una decisión: volvemos a mostrar el aviso principal.
      banner.hidden = false;
      var configBtn = banner.querySelector('[data-action="configure"]');
      if (configBtn) configBtn.focus();
    } else if (returnFocusEl && document.body.contains(returnFocusEl)) {
      returnFocusEl.focus();
    }
  }

  function finish(consent) {
    closeBanner();
    modalBackdrop.hidden = true;
    activateScripts(consent);
    if (returnFocusEl && document.body.contains(returnFocusEl) && returnFocusEl !== document.body) {
      returnFocusEl.focus();
    }
  }

  function wireSettingsLinks() {
    var links = document.querySelectorAll('[data-cookie-settings]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        openModal(false);
      });
    }
  }

  function init() {
    buildUI();
    wireSettingsLinks();
    var consent = readConsent();
    if (consent) {
      activateScripts(consent);
    } else {
      openBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
