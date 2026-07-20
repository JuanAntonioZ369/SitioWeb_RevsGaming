/**
 * RevsGaming — Shared i18n (EN/ES)
 *
 * register() formats accepted:
 *   flat object  → treated as ES translations (legacy, for backward compat)
 *   { es: {...} } → explicit ES translations
 *   { en: {...} } → explicit EN translations (use when HTML defaults are in Spanish)
 *   { en: {...}, es: {...} } → both explicit
 *
 * HTML content is always the ultimate fallback (data-i18n-default).
 */

window.RVGi18n = (function () {

  /* ── Common keys (every page) ── */
  const common = {
    es: {
      'nav.home':        'Inicio',
      'nav.features':    'Características',
      'nav.consoles':    'Consolas',
      'nav.multiplayer': 'Multijugador',
      'nav.signup':      'Registrarse',
      'nav.download':    'Descargar Beta',
      'btn.open.app':    'Abrir la app',
      'btn.download':    'Descargar RevsGaming',
      'footer.home':     'Inicio',
      'footer.privacy':  'Privacidad',
      'footer.terms':    'Términos',
      'footer.download': 'Descargar',
      'footer.bugreport':'Reportar bug',
      'footer.brand.desc':'Lanzador retro para Windows con netplay online, biblioteca automática y cloud saves.',
      'toast.no.app':      '¿No tienes RevsGaming instalado?',
      'toast.download.btn':'Descargar ahora',
      'toast.close':       'Cerrar',
    }
  }

  /* pageKeys stores translations by language explicitly */
  let pageKeys = { en: {}, es: {} }
  let _initialized = false
  let _currentLang = 'en'

  /* ─────────────────────────────────────
     register() — call from each page
     Safe to call before OR after init()
  ───────────────────────────────────── */
  function register(keys) {
    if (keys && (keys.en !== undefined || keys.es !== undefined)) {
      /* New explicit format: { en: {...}, es: {...} } */
      if (keys.en) pageKeys.en = Object.assign({}, pageKeys.en, keys.en)
      if (keys.es) pageKeys.es = Object.assign({}, pageKeys.es, keys.es)
    } else if (keys) {
      /* Legacy flat format → treat as ES translations */
      pageKeys.es = Object.assign({}, pageKeys.es, keys)
    }
    if (_initialized) {
      applyLang(_currentLang)
    }
  }

  /* ─────────────────────────────────────
     applyLang() — apply translations
  ───────────────────────────────────── */
  function applyLang(lang) {
    _currentLang = lang

    const dict = lang === 'es'
      ? Object.assign({}, common.es, pageKeys.es)
      : Object.assign({}, pageKeys.en)

    /* Text nodes */
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n')

      /* Save the HTML original the very first time we touch each element */
      if (!el.hasAttribute('data-i18n-default')) {
        el.setAttribute('data-i18n-default', el.innerHTML)
      }

      if (dict[key]) {
        el.innerHTML = dict[key]
      } else {
        /* No translation for this language → restore original HTML */
        var def = el.getAttribute('data-i18n-default')
        if (def !== null) el.innerHTML = def
      }
    })

    /* Input/textarea placeholders */
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder')

      if (!el.hasAttribute('data-placeholder-default')) {
        el.setAttribute('data-placeholder-default', el.placeholder)
      }

      if (dict[key]) {
        el.placeholder = dict[key]
      } else {
        var def = el.getAttribute('data-placeholder-default')
        if (def !== null) el.placeholder = def
      }
    })

    /* Lang-toggle label: shows the OTHER language the user can switch to */
    document.querySelectorAll('.lang-label, .lang-label-mobile').forEach(function (el) {
      el.textContent = lang === 'en' ? 'ES' : 'EN'
    })

    document.documentElement.lang = lang
    localStorage.setItem('revsgaming-lang', lang)
    window._rvgLang = lang
  }

  /* ─────────────────────────────────────
     init() — called once when DOM ready
  ───────────────────────────────────── */
  function init() {
    _initialized = true

    /* Snapshot HTML defaults BEFORE first translation */
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (!el.hasAttribute('data-i18n-default')) {
        el.setAttribute('data-i18n-default', el.innerHTML)
      }
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      if (!el.hasAttribute('data-placeholder-default')) {
        el.setAttribute('data-placeholder-default', el.placeholder)
      }
    })

    var saved = localStorage.getItem('revsgaming-lang') || 'en'
    applyLang(saved)

    /* Bind every lang toggle on the page */
    document.querySelectorAll(
      '#langToggle, #langToggleMobile, .lang-toggle-btn, .lang-toggle'
    ).forEach(function (btn) {
      if (btn._i18nBound) return
      btn._i18nBound = true
      btn.addEventListener('click', function () {
        applyLang(_currentLang === 'en' ? 'es' : 'en')
      })
    })
  }

  /* Auto-init when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  return { init: init, applyLang: applyLang, register: register }

})()
