/**
 * RevsGaming — Shared UI Effects
 * Custom cursor (green dot + ring) and scroll progress bar.
 * Include on every page EXCEPT index.html (which has its own inline version).
 * Safe to include multiple times — checks for existing elements.
 */
;(function () {

  /* ── Inject CSS ── */
  var style = document.createElement('style')
  style.textContent = [
    /* Scroll progress bar */
    '#scroll-progress{',
      'position:fixed;top:0;left:0;width:0%;height:2px;',
      'background:linear-gradient(90deg,var(--green,#7EC8A0) 0%,var(--accent,#66c0f4) 60%,var(--green-light,#a8d8b8) 100%);',
      'z-index:10001;transform-origin:left center;',
      'transition:width 0.08s linear;',
      'box-shadow:0 0 8px rgba(126,200,160,.5),0 0 2px rgba(102,192,244,.4);',
      'pointer-events:none;',
    '}',
    /* Custom cursor — desktop only */
    '@media (hover:hover) and (pointer:fine){',
      'body,a,button{cursor:none!important}',
      '#cursor-dot{',
        'position:fixed;top:0;left:0;width:6px;height:6px;',
        'background:var(--green,#7EC8A0);border-radius:50%;',
        'pointer-events:none;z-index:99999;',
        'transform:translate(-50%,-50%);',
        'transition:transform .08s ease,background .2s ease;',
        'will-change:transform;',
      '}',
      '#cursor-ring{',
        'position:fixed;top:0;left:0;width:32px;height:32px;',
        'border:1.5px solid rgba(126,200,160,.6);border-radius:50%;',
        'pointer-events:none;z-index:99998;',
        'transform:translate(-50%,-50%);',
        'transition:width .2s ease,height .2s ease,border-color .2s ease;',
        'will-change:transform;',
      '}',
      '#cursor-ring.hovered{width:48px;height:48px;border-color:var(--accent,#66c0f4)}',
    '}'
  ].join('')
  document.head.appendChild(style)

  /* ── Run after DOM is ready ── */
  function setup() {

    /* Scroll progress bar */
    if (!document.getElementById('scroll-progress')) {
      var bar = document.createElement('div')
      bar.id = 'scroll-progress'
      bar.setAttribute('aria-hidden', 'true')
      document.body.insertBefore(bar, document.body.firstChild)
    }
    var progressBar = document.getElementById('scroll-progress')
    window.addEventListener('scroll', function () {
      var scrollTop    = document.documentElement.scrollTop
      var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      progressBar.style.width = (scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0) + '%'
    }, { passive: true })

    /* Custom cursor */
    if (window.matchMedia('(hover:none)').matches) return

    if (!document.getElementById('cursor-dot')) {
      var dot = document.createElement('div')
      dot.id = 'cursor-dot'
      dot.setAttribute('aria-hidden', 'true')
      document.body.appendChild(dot)
    }
    if (!document.getElementById('cursor-ring')) {
      var ring = document.createElement('div')
      ring.id = 'cursor-ring'
      ring.setAttribute('aria-hidden', 'true')
      document.body.appendChild(ring)
    }

    var dotEl  = document.getElementById('cursor-dot')
    var ringEl = document.getElementById('cursor-ring')
    var mx = 0, my = 0, rx = 0, ry = 0

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY
      dotEl.style.left = mx + 'px'
      dotEl.style.top  = my + 'px'
    }, { passive: true })

    ;(function lerp() {
      rx += (mx - rx) * 0.12
      ry += (my - ry) * 0.12
      ringEl.style.left = rx + 'px'
      ringEl.style.top  = ry + 'px'
      requestAnimationFrame(lerp)
    })()

    document.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () { ringEl.classList.add('hovered') })
      el.addEventListener('mouseleave', function () { ringEl.classList.remove('hovered') })
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup)
  } else {
    setup()
  }

})()
