/**
 * /api/config — Exposes safe public config values from Vercel env vars.
 * Set PAYPAL_CLIENT_ID and PAYPAL_MODE in Vercel Dashboard → Settings → Environment Variables.
 */
export default function handler(req, res) {
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || ''
  const paypalMode     = process.env.PAYPAL_MODE || 'live'

  if (!paypalClientId) {
    return res.status(500).json({ error: 'PAYPAL_CLIENT_ID not configured' })
  }

  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({ paypalClientId, paypalMode })
}
