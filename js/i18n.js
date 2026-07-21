/**
 * RevsGaming — i18n (English only)
 * Language is fixed to English. Any stored 'es' preference is cleared.
 */

window.RVGi18n = (function () {

  function init() {
    /* Force English — clear any stored Spanish preference */
    localStorage.removeItem('revsgaming-lang')
    localStorage.setItem('revsgaming-lang', 'en')
    window._rvgLang = 'en'
    document.documentElement.lang = 'en'

    /* Restore all data-i18n elements to their original HTML (English defaults) */
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.hasAttribute('data-i18n-default')) {
        el.innerHTML = el.getAttribute('data-i18n-default')
      }
    })
  }

  function register() { /* no-op — translations disabled */ }
  function applyLang() { /* no-op — English only */ }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  return { init: init, applyLang: applyLang, register: register }

})()
