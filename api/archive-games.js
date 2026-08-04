/**
 * /api/archive-games — Proxy for Archive.org search API
 * Avoids CORS issues by fetching server-side from Vercel.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const uploader = 'juan_antonio_zegarra_condori'
  const url =
    `https://archive.org/advancedsearch.php` +
    `?q=uploader%3A${uploader}` +
    `&fl[]=identifier,title,subject,description,mediatype` +
    `&rows=300&output=json&page=1`

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'revsgaming-site/1.0' }
    })
    if (!r.ok) throw new Error('archive.org returned ' + r.status)

    const json = await r.json()
    const docs = (json?.response?.docs) || []

    // Filter out BIOS collections and account items
    const games = docs.filter(item => {
      const id    = (item.identifier || '').toLowerCase()
      const title = (item.title      || '').toLowerCase()
      const type  = (item.mediatype  || '').toLowerCase()
      return type !== 'account' && !id.includes('bios') && !title.includes('bios')
    })

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
    return res.status(200).json({ games })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
