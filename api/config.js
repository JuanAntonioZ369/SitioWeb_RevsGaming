/**
 * /api/config — Exposes safe public config values from Vercel env vars.
 * Set CULQI_PUBLIC_KEY in Vercel Dashboard → Settings → Environment Variables.
 */
export default function handler(req, res) {
  const culqiKey = process.env.CULQI_PUBLIC_KEY || ''

  if (!culqiKey) {
    return res.status(500).json({ error: 'CULQI_PUBLIC_KEY not configured' })
  }

  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({ culqiKey })
}
