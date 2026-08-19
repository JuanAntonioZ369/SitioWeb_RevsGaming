/**
 * /api/archive-games
 * Lee los identifiers de archive.org desde app_config en Supabase.
 * Filas usadas:
 *   - games_solo_id  → URLs separadas por coma, colecciones 1 jugador
 *   - games_multi_id → URLs separadas por coma, colecciones multijugador
 *
 * Para agregar una colección nueva: editar esas filas en Supabase, sin tocar código.
 */

const BASE    = 'https://archive.org'
const HEADERS = { 'User-Agent': 'revsgaming-site/1.0', Accept: 'application/json' }
const ROM_EXT = /\.(iso|bin|cue|zip|7z|rar|rom|nes|sfc|smc|gba|n64|z64|v64|gb|gbc|md|gen|pbp|chd|img|ccd|pce|ws|wsc)$/i

function fetchWithTimeout (url, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { headers: HEADERS, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

/** Extrae el identifier de una URL de archive.org o lo devuelve tal cual si no es URL */
function extractIdentifier (raw) {
  raw = raw.trim()
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/').filter(Boolean)
    // /details/IDENTIFIER  o  /download/IDENTIFIER
    const idx = parts.findIndex(p => p === 'details' || p === 'download')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
  } catch (_) { /* not a URL */ }
  return raw
}

/** Determina el sistema basado en el identifier */
function detectSystem (identifier) {
  const id = identifier.toLowerCase()
  if (id.startsWith('ps1') || id.includes('ps1')) return 'ps1'
  if (id.startsWith('snes') || id.includes('snes')) return 'snes'
  if (id.startsWith('nes') && !id.includes('snes')) return 'nes'
  if (id.startsWith('gba') || id.includes('gba')) return 'gba'
  if (id.startsWith('n64') || id.includes('n64')) return 'n64'
  if (id.startsWith('gb') || id.includes('gameboy')) return 'gb'
  return 'other'
}

// Fallback hardcodeado — se usa si Supabase no responde
const FALLBACK_IDS = ['ps1-1jugador', 'ps1-multijugador', 'SNES-ROMs-Multijugador']

/** Lee los identifiers desde app_config en Supabase, con fallback hardcodeado */
async function getIdentifiersFromSupabase () {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[archive-games] Supabase env vars not set, using fallback IDs')
    return FALLBACK_IDS
  }

  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/app_config?select=key,value`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    )
    if (!r.ok) {
      console.warn('[archive-games] Supabase returned', r.status, '— using fallback IDs')
      return FALLBACK_IDS
    }
    const rows = await r.json()

    // Filtrar solo las filas de games
    const gameRows = rows.filter(row =>
      row.key === 'games_solo_id' || row.key === 'games_multi_id'
    )

    if (gameRows.length === 0) {
      console.warn('[archive-games] No game rows found in app_config — using fallback IDs')
      return FALLBACK_IDS
    }

    const identifiers = []
    for (const row of gameRows) {
      const urls = (row.value || '').split(',')
      for (const url of urls) {
        const id = extractIdentifier(url)
        if (id) identifiers.push(id)
      }
    }
    return identifiers.length > 0 ? identifiers : FALLBACK_IDS
  } catch (e) {
    console.warn('[archive-games] Supabase fetch error:', e.message, '— using fallback IDs')
    return FALLBACK_IDS
  }
}

/** Obtiene los archivos ROM de un identifier de archive.org */
async function fetchCollection (identifier) {
  try {
    const r = await fetchWithTimeout(`${BASE}/metadata/${identifier}`)
    if (!r.ok) return []
    const meta = await r.json()

    const collectionTitle = meta.metadata?.title || identifier
    const system = detectSystem(identifier)

    const files = (meta.files || []).filter(f => {
      const name = f.name || ''
      return ROM_EXT.test(name) && !name.startsWith('_') && (f.format || '') !== 'Metadata'
    })

    return files.map(f => ({
      identifier,
      collectionTitle,
      filename:    f.name,
      title:       f.name.replace(ROM_EXT, '').replace(/[_]/g, ' ').trim(),
      system,
      size:        f.size ? parseInt(f.size) : 0,
      downloadUrl: `${BASE}/download/${identifier}/${encodeURIComponent(f.name)}`,
      thumbUrl:    `${BASE}/services/img/${identifier}`,
      archiveUrl:  `${BASE}/details/${identifier}`
    }))
  } catch (_) {
    return []
  }
}

export default async function handler (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')

  try {
    const identifiers = await getIdentifiersFromSupabase()

    if (identifiers.length === 0) {
      return res.status(200).json({ games: [] })
    }

    const results = await Promise.all(identifiers.map(fetchCollection))
    const games = results.flat()

    return res.status(200).json({ games })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
