const ALLOWED_PLANS = new Set(['monthly', 'annual', 'trial'])

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const cronSecret = process.env.CRON_SECRET
  const resendKey  = process.env.RESEND_API_KEY
  if (!cronSecret || !resendKey) {
    return res.status(503).json({ error: 'Server misconfiguration' })
  }

  const incomingSecret = req.headers['x-cron-secret'] || ''
  if (incomingSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' })
  }

  const { user_id, email, expires_at, plan } = req.body || {}

  if (
    !user_id    || typeof user_id    !== 'string' || !/^[0-9a-f-]{36}$/.test(user_id) ||
    !email      || typeof email      !== 'string' || !email.includes('@') ||
    !expires_at || typeof expires_at !== 'string' ||
    !plan       || !ALLOWED_PLANS.has(plan)
  ) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const expiryDate = new Date(expires_at)
  if (isNaN(expiryDate.getTime())) {
    return res.status(400).json({ error: 'Invalid expires_at date' })
  }

  const formattedDate = expiryDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })

  const planLabel = plan === 'annual' ? 'Annual' : plan === 'monthly' ? 'Monthly' : 'Trial'

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:system-ui,sans-serif;color:#e5e5e5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
        <tr>
          <td style="background:#7c3aed;padding:24px 32px">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">RevsGaming</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fff">Your subscription expires in 7 days</h1>
            <p style="margin:0 0 8px;color:#a3a3a3;font-size:14px">Plan: <span style="color:#e5e5e5">${planLabel}</span></p>
            <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px">Expiry date: <span style="color:#e5e5e5">${formattedDate}</span></p>
            <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.6">
              Keep enjoying unlimited retro gaming, PS1 netplay, and all RevsGaming features — renew before your plan runs out.
            </p>
            <a href="https://revsgaming.com/upgrade.html"
               style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600">
              Renew subscription
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #2a2a2a">
            <p style="margin:0;color:#525252;font-size:12px">
              You received this email because your RevsGaming account is approaching its expiry date.<br>
              If you have questions, reply to this email or visit <a href="https://revsgaming.com" style="color:#7c3aed;text-decoration:none">revsgaming.com</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  let resendResponse
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        from:    'RevsGaming <noreply@revsgaming.com>',
        to:      [email],
        subject: 'Your RevsGaming subscription expires in 7 days',
        html:    htmlBody
      }),
      signal: AbortSignal.timeout(8000)
    })
  } catch (e) {
    console.error('[notify-expiry] Resend network error:', e.message)
    return res.status(502).json({ error: 'Failed to reach email provider' })
  }

  if (!resendResponse.ok) {
    const body = await resendResponse.text().catch(() => '')
    console.error('[notify-expiry] Resend error:', resendResponse.status, body)
    return res.status(502).json({ error: 'Email provider returned an error' })
  }

  console.info('[notify-expiry] Expiry email sent to:', email, '| user:', user_id, '| plan:', plan)
  return res.status(200).json({ success: true })
}
