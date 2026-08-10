/**
 * /api/archive-games
 * Fetches individual ROM files from known archive.org collection identifiers.
 * Collections: ps1-1jugador, ps1-multijugador
 */
const BASE       = 'https://archive.org'
const HEADERS    = { 'User-Agent': 'revsgaming-site/1.0', Accept: 'application/json' }
const COLLECTION_IDS = ['ps1-1jugador', 'ps1-multijugador']

const ROM_EXT = /\.(iso|bin|cue|zip|7z|rar|rom|nes|sfc|smc|gba|n64|z64|v64|gb|gbc|md|gen|pbp|chd|img|ccd|pce|ws|wsc)$/i

function fetchWithTimeout (url, ms = 7000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { headers: HEADERS, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

export default async function handler (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')

  try {
    const results = await Promise.all(
      COLLECTION_IDS.map(async identifier => {
        try {
          const r = await fetchWithTimeout(`${BASE}/metadata/${identifier}`)
          if (!r.ok) return []
          const meta = await r.json()

          const collectionTitle = meta.metadata?.title || identifier

          const files = (meta.files || []).filter(f => {
            const name = f.name || ''
            return ROM_EXT.test(name) && !name.startsWith('_') && (f.format || '') !== 'Metadata'
          })

          const system = identifier.startsWith('ps1') ? 'ps1' : 'other'

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
      })
    )

    const games = results.flat()

    // Fallback: if no individual files found, return the collections as cards
    if (games.length === 0) {
      const collections = COLLECTION_IDS.map(id => ({
        identifier:   id,
        title:        id === 'ps1-1jugador' ? 'PS1 ROMs – 1 Jugador' : 'PS1 ROMs – Multijugador',
        thumbUrl:     `${BASE}/services/img/${id}`,
        archiveUrl:   `${BASE}/details/${id}`,
        isCollection: true
      }))
      return res.status(200).json({ games: collections })
    }

    return res.status(200).json({ games })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
