/**
 * /api/archive-games
 * 1. Fetches the uploader's items from archive.org
 * 2. For each non-BIOS item, fetches its file list (individual ROMs)
 * 3. Returns a flat array of game objects
 */
const UPLOADER = 'juan_antonio_zegarra_condori'
const BASE     = 'https://archive.org'
const HEADERS  = { 'User-Agent': 'revsgaming-site/1.0', Accept: 'application/json' }

function fetchWithTimeout (url, ms = 6000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { headers: HEADERS, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

// ROM file extensions we care about
const ROM_EXT = /\.(iso|bin|cue|zip|7z|rar|rom|nes|sfc|smc|gba|n64|z64|v64|gb|gbc|gbs|md|gen|sg|smd|pce|ws|wsc|nds|3ds|pbp|chd|img|ccd)$/i

function isBios (str) {
  return /bios/i.test(str)
}

export default async function handler (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')

  try {
    // ── Step 1: get all items uploaded by user ──────────────────
    const searchUrl =
      `${BASE}/advancedsearch.php` +
      `?q=uploader:(${UPLOADER})` +
      `&fl[]=identifier,title,mediatype,subject` +
      `&rows=100&output=json&page=1`

    const searchRes = await fetchWithTimeout(searchUrl, 7000)
    if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`)
    const searchJson = await searchRes.json()

    const items = (searchJson?.response?.docs || []).filter(item => {
      const id    = (item.identifier || '').toLowerCase()
      const title = (item.title      || '').toLowerCase()
      const type  = (item.mediatype  || '').toLowerCase()
      return type !== 'account' && !isBios(id) && !isBios(title)
    })

    if (items.length === 0) {
      return res.status(200).json({ games: [], collections: [] })
    }

    // ── Step 2: for each item, fetch its file list ──────────────
    const results = await Promise.all(
      items.map(async item => {
        try {
          const metaRes = await fetchWithTimeout(`${BASE}/metadata/${item.identifier}`, 5000)
          if (!metaRes.ok) return []
          const meta = await metaRes.json()

          const files = (meta.files || []).filter(f => {
            const name   = f.name || ''
            const format = (f.format || '').toLowerCase()
            return (
              ROM_EXT.test(name) &&
              !isBios(name) &&
              format !== 'metadata' &&
              !name.startsWith('_')
            )
          })

          return files.map(f => {
            const cleanTitle = f.name
              .replace(ROM_EXT, '')           // remove extension
              .replace(/[_-]/g, ' ')          // underscores/dashes → spaces
              .replace(/\s+/g, ' ')
              .trim()

            return {
              identifier:      item.identifier,
              collectionTitle: item.title || item.identifier,
              filename:        f.name,
              title:           cleanTitle || f.name,
              size:            f.size ? parseInt(f.size) : 0,
              downloadUrl:     `${BASE}/download/${item.identifier}/${encodeURIComponent(f.name)}`,
              thumbUrl:        `${BASE}/services/img/${item.identifier}`,
              archiveUrl:      `${BASE}/details/${item.identifier}`
            }
          })
        } catch (_) {
          return []
        }
      })
    )

    const games = results.flat()

    // If no individual files found, fall back to showing the collections themselves
    if (games.length === 0) {
      const collections = items.map(item => ({
        identifier:  item.identifier,
        title:       item.title || item.identifier,
        thumbUrl:    `${BASE}/services/img/${item.identifier}`,
        archiveUrl:  `${BASE}/details/${item.identifier}`,
        isCollection: true
      }))
      return res.status(200).json({ games: collections, collections: true })
    }

    return res.status(200).json({ games })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
