/**
 * RevsGaming — Shared i18n (EN/ES)
 * Include this file in every page AFTER the page's own content.
 * Each page adds its own keys to window.pageTranslations before this runs,
 * OR uses the common keys defined here.
 */

window.RVGi18n = (function() {

  // Common translations shared by all pages
  const common = {
    es: {
      // Navbar (common links)
      'nav.home':        'Inicio',
      'nav.features':    'Características',
      'nav.consoles':    'Consolas',
      'nav.multiplayer': 'Multijugador',
      'nav.signup':      'Registrarse',
      'nav.download':    'Descargar Beta',
      // Buttons
      'btn.open.app':    'Abrir la app',
      'btn.download':    'Descargar RevsGaming',
      // Footer
      'footer.home':    'Inicio',
      'footer.privacy': 'Privacidad',
      'footer.terms':   'Términos',
      // Toast app not installed
      'toast.no.app':      '¿No tienes RevsGaming instalado?',
      'toast.download.btn':'Descargar ahora',
      'toast.close':       'Cerrar',
    }
  }

  // Page-specific translations registered per page
  let pageKeys = {}

  function register(keys) {
    pageKeys = Object.assign({}, pageKeys, keys)
  }

  function applyLang(lang) {
    const dict = lang === 'es'
      ? Object.assign({}, common.es, pageKeys)
      : null

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n')
      if (lang === 'es' && dict[key]) {
        el.setAttribute('data-i18n-default', el.getAttribute('data-i18n-default') || el.innerHTML)
        el.innerHTML = dict[key]
      } else {
        const def = el.getAttribute('data-i18n-default')
        if (def) el.innerHTML = def
      }
    })

    // Update lang toggle label
    document.querySelectorAll('.lang-label').forEach(el => {
      el.textContent = lang === 'en' ? 'ES' : 'EN'
    })
    document.documentElement.lang = lang
    localStorage.setItem('revsgaming-lang', lang)
    window._rvgLang = lang
  }

  function init() {
    // Save defaults before applying any translation
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (!el.getAttribute('data-i18n-default')) {
        el.setAttribute('data-i18n-default', el.innerHTML)
      }
    })

    const saved = localStorage.getItem('revsgaming-lang') || 'en'
    window._rvgLang = saved
    applyLang(saved)

    document.querySelectorAll('#langToggle, #langToggleMobile, .lang-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyLang(window._rvgLang === 'en' ? 'es' : 'en')
      })
    })
  }

  return { init, applyLang, register }
})()

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.RVGi18n.init)
} else {
  window.RVGi18n.init()
}
