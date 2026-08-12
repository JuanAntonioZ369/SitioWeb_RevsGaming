/**
 * auth-nav.js — Actualiza el navbar según sesión de Supabase.
 * Lee el username actual desde la tabla profiles (no user_metadata).
 */
;(function () {
  var SUPABASE_URL  = 'https://kyoyunuwfuujqdomdmlh.supabase.co'
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5b3l1bnV3ZnV1anFkb21kbWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTY5MDksImV4cCI6MjA5NzE5MjkwOX0.AJfWxp7rcn9psHFZQpX9qmCw32rsYo9pYiIpxHfIX3I'

  function esc(s) {
    var d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function avatarHtml(initial, size) {
    size = size || 28
    var fs = Math.round(size * 0.43)
    return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
      + 'background:linear-gradient(135deg,#7EC8A0,#66c0f4);display:flex;align-items:center;'
      + 'justify-content:center;font-family:\'Space Grotesk\',sans-serif;font-size:' + fs + 'px;'
      + 'font-weight:700;color:#0d1117;flex-shrink:0;">' + initial + '</div>'
  }

  function renderNav(username) {
    var initial = username.charAt(0).toUpperCase()

    var desktopHtml = '<a href="/dashboard" style="display:flex;align-items:center;gap:8px;'
      + 'padding:6px 14px;border-radius:8px;border:1px solid rgba(126,200,160,0.3);'
      + 'background:rgba(126,200,160,0.08);text-decoration:none;transition:background 0.2s;"'
      + ' onmouseover="this.style.background=\'rgba(126,200,160,0.15)\'"'
      + ' onmouseout="this.style.background=\'rgba(126,200,160,0.08)\'">'
      + avatarHtml(initial, 28)
      + '<span style="font-size:0.85rem;font-weight:600;color:#7EC8A0;">' + esc(username) + '</span>'
      + '</a>'

    var mobileHtml = '<a href="/dashboard" style="display:flex;align-items:center;gap:10px;'
      + 'padding:10px 12px;border-radius:6px;text-decoration:none;">'
      + avatarHtml(initial, 32)
      + '<span style="font-size:0.9rem;font-weight:500;color:#7EC8A0;">' + esc(username) + '</span>'
      + '</a>'

    var desktop = document.getElementById('navAuthDesktop')
    var mobile  = document.getElementById('navAuthMobile')
    if (desktop) desktop.innerHTML = desktopHtml
    if (mobile)  mobile.innerHTML  = mobileHtml
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (!window.supabase) return
    var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)

    db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session
      if (!session) return

      var user = session.user
      var fallback = (user.user_metadata && user.user_metadata.username)
        || user.email.split('@')[0]

      // Mostrar fallback de inmediato, luego actualizar con el nombre real
      renderNav(fallback)

      // Leer username actual desde profiles
      db.from('profiles').select('username').eq('id', user.id).single()
        .then(function (r) {
          var username = (r.data && r.data.username) || fallback
          renderNav(username)
        })
    })
  })
})()
