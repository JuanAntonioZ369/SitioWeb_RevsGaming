/**
 * RevsGaming — Shared i18n (EN/ES)
 * Works correctly regardless of whether the script loads via defer,
 * sync, or at the bottom of body. Pages call register() to add their
 * own keys; if init() already ran, translations re-apply immediately.
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

  let pageKeys     = {}
  let _initialized = false
  let _currentLang = 'en'

  /* ─────────────────────────────────────
     register() — call from each page
     Safe to call before OR after init()
  ───────────────────────────────────── */
  function register(keys) {
    pageKeys = Object.assign({}, pageKeys, keys)
    if (_initialized) {
      // init() already ran without these keys → re-apply now
      applyLang(_currentLang)
    }
  }

  /* ─────────────────────────────────────
     applyLang() — apply translations
  ───────────────────────────────────── */
  function applyLang(lang) {
    _currentLang = lang
    const dict = lang === 'es'
      ? Object.assign({}, common.es, pageKeys)
      : null

    /* Text nodes */
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n')
      if (lang === 'es' && dict[key]) {
        /* Save EN default the first time */
        if (!el.hasAttribute('data-i18n-default')) {
          el.setAttribute('data-i18n-default', el.innerHTML)
        }
        el.innerHTML = dict[key]
      } else {
        const def = el.getAttribute('data-i18n-default')
        if (def) el.innerHTML = def
      }
    })

    /* Input/textarea placeholders */
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder')
      if (lang === 'es' && dict && dict[key]) {
        if (!el.hasAttribute('data-placeholder-en')) {
          el.setAttribute('data-placeholder-en', el.placeholder)
        }
        el.placeholder = dict[key]
      } else {
        const def = el.getAttribute('data-placeholder-en')
        if (def) el.placeholder = def
      }
    })

    /* Lang-toggle label: shows the OTHER language the user can switch to */
    document.querySelectorAll('.lang-label, .lang-label-mobile').forEach(el => {
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

    /* Snapshot EN defaults BEFORE first translation */
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (!el.hasAttribute('data-i18n-default')) {
        el.setAttribute('data-i18n-default', el.innerHTML)
      }
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      if (!el.hasAttribute('data-placeholder-en')) {
        el.setAttribute('data-placeholder-en', el.placeholder)
      }
    })

    const saved = localStorage.getItem('revsgaming-lang') || 'en'
    applyLang(saved)

    /* Bind every lang toggle on the page */
    document.querySelectorAll(
      '#langToggle, #langToggleMobile, .lang-toggle-btn, .lang-toggle'
    ).forEach(btn => {
      // Avoid double-binding if init() is ever called more than once
      if (btn._i18nBound) return
      btn._i18nBound = true
      btn.addEventListener('click', () => {
        applyLang(_currentLang === 'en' ? 'es' : 'en')
      })
    })
  }

  /* Auto-init when DOM is ready (works with defer, sync, or at body bottom) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  return { init, applyLang, register }

})()
