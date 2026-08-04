/**
 * RevsGaming — App deep link helper
 * Usage: openRevsGamingApp() → tries revsgaming:// → fallback toast
 */
function openRevsGamingApp() {
  let appLaunched = false

  // Si la página pierde visibilidad o foco, asumimos que el OS abrió la app
  const onHide = () => { appLaunched = true }
  document.addEventListener('visibilitychange', onHide, { once: true })
  window.addEventListener('blur', onHide, { once: true })

  window.location.href = 'revsgaming://login'

  setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('blur', onHide)

    if (appLaunched) return // La app se abrió correctamente

    // La app no está instalada o no está corriendo → mostrar toast
    const existing = document.getElementById('rvg-app-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'rvg-app-toast'
    toast.style.cssText = [
      'position:fixed','bottom:32px','left:50%','transform:translateX(-50%)',
      'background:var(--bg-card, #16202d)','border:1px solid var(--border, rgba(102,192,244,0.15))',
      'padding:20px 28px','border-radius:14px','z-index:9999',
      'box-shadow:0 8px 32px rgba(0,0,0,0.35)','text-align:center',
      "font-family:'Inter',sans-serif",'color:var(--text,#c6d4df)','max-width:360px','width:90%'
    ].join(';')

    toast.innerHTML = `
      <p style="margin:0 0 6px;font-size:0.95rem;font-weight:600;color:var(--text,#c6d4df);">
        RevsGaming is not running
      </p>
      <p style="margin:0 0 14px;font-size:0.82rem;color:var(--text-muted,#8f98a0);line-height:1.5;">
        Make sure the app is open, or download it if you haven't yet.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="/download/"
           style="background:var(--green,#7EC8A0);color:#0d1117;padding:9px 18px;border-radius:7px;
                  font-weight:700;text-decoration:none;font-family:'Space Grotesk',sans-serif;
                  display:inline-block;font-size:0.85rem;">
          ⬇ Download
        </a>
        <button onclick="document.getElementById('rvg-app-toast').remove()" style="
          background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
          color:var(--text-muted,#8f98a0);cursor:pointer;font-size:0.85rem;
          padding:9px 18px;border-radius:7px;">
          Close
        </button>
      </div>
    `
    document.body.appendChild(toast)
    setTimeout(() => { if (toast.parentElement) toast.remove() }, 9000)
  }, 2500)
}
