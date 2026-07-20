/**
 * RevsGaming — Site-wide configuration
 * Change values here and they update everywhere automatically.
 * Include this script BEFORE i18n.js on every page.
 */

window.RVGConfig = {
  email:       'jnntnzegarra369@gmail.com',
  ruc:         '20613365045',
  brand:       'RevsGaming',
  year:        '2026',
  downloadUrl: '/download/',
  version:     'v0.84.0',
}

;(function () {
  function fill () {
    var c = window.RVGConfig

    /* <a data-cfg="email"> → fills href + text */
    document.querySelectorAll('[data-cfg="email"]').forEach(function (el) {
      el.href        = 'mailto:' + c.email
      el.textContent = c.email
    })

    /* <span data-cfg="ruc"> → fills text */
    document.querySelectorAll('[data-cfg="ruc"]').forEach(function (el) {
      el.textContent = c.ruc
    })

    /* <span data-cfg="year"> */
    document.querySelectorAll('[data-cfg="year"]').forEach(function (el) {
      el.textContent = c.year
    })

    /* <a data-cfg="download"> → fills download href */
    document.querySelectorAll('[data-cfg="download"]').forEach(function (el) {
      el.href = c.downloadUrl
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fill)
  } else {
    fill()
  }
})()
