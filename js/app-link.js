/**
 * RevsGaming — App deep link helper
 * Usage: openRevsGamingApp() → tries revsgaming:// → fallback toast
 */
function openRevsGamingApp(redirectAfter) {
  window.location.href = 'revsgaming://login'
  setTimeout(() => {
    // If still here, app not installed — show toast
    const existing = document.getElementById('rvg-app-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'rvg-app-toast'
    toast.style.cssText = [
      'position:fixed','bottom:32px','left:50%','transform:translateX(-50%)',
      'background:var(--bg-card, #16202d)','border:1px solid var(--border, rgba(102,192,244,0.15))',
      'padding:20px 28px','border-radius:14px','z-index:9999',
      'box-shadow:0 8px 32px rgba(0,0,0,0.35)','text-align:center',
      "font-family:'Inter',sans-serif",'color:var(--text,#c6d4df)','max-width:340px','width:90%'
    ].join(';')

    toast.innerHTML = `
      <p style="margin-bottom:14px;font-size:0.9rem;line-height:1.5">
        Don't have RevsGaming installed?
      </p>
      <a href="https://github.com/JuanAntonioZ369/RetroGamingRevs_2.0/releases/tag/v0.84.0"
         target="_blank" rel="noopener"
         style="background:var(--green,#7EC8A0);color:#0d1117;padding:10px 22px;border-radius:7px;
                font-weight:700;text-decoration:none;font-family:'Space Grotesk',sans-serif;
                display:inline-block;font-size:0.9rem;">
        ⬇ Download now
      </a>
      <button onclick="document.getElementById('rvg-app-toast').remove()" style="
        display:block;margin:12px auto 0;background:none;border:none;
        color:var(--text-muted,#8f98a0);cursor:pointer;font-size:0.8rem;">
        Close
      </button>
    `
    document.body.appendChild(toast)
    setTimeout(() => { if (toast.parentElement) toast.remove() }, 8000)
  }, 2000)
}
