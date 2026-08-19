/**
 * RevsGaming — Payment API (Vercel Serverless Function)
 * Endpoint: POST /api/payment
 *
 * Planes:
 *   monthly — $2.99 USD (30 días)
 *   annual  — $29.99 USD (365 días)
 *
 * Flujo PayPal:
 *   action=create-order → crea una orden en PayPal, devuelve { orderID }
 *   action=capture-order → captura y verifica el pago, activa suscripción en Supabase
 *
 * Variables de entorno requeridas en Vercel:
 *   PAYPAL_CLIENT_ID     → Client ID de tu app PayPal
 *   PAYPAL_SECRET        → Secret de tu app PayPal
 *   PAYPAL_MODE          → "sandbox" | "live" (default: live)
 *   SUPABASE_URL         → https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY → service_role key
 */

// ---------------------------------------------------------------------------
// Planes — hardcodeados server-side (el cliente NUNCA controla el precio)
// ---------------------------------------------------------------------------
const PLANS = {
  monthly: { amount: '2.99',  currency: 'USD', days: 30,  label: 'monthly', description: 'RevsGaming — Monthly Access' },
  annual:  { amount: '29.99', currency: 'USD', days: 365, label: 'annual',  description: 'RevsGaming — Annual Access'  }
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------
const rateLimitStore = new Map()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5

function isRateLimited(ip) {
  const now  = Date.now()
  const prev = rateLimitStore.get(ip)
  if (!prev || now - prev.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now })
    return false
  }
  prev.count++
  rateLimitStore.set(ip, prev)
  return prev.count > RATE_LIMIT_MAX
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'https://revsgaming.com',
  'https://www.revsgaming.com',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
])

function applySecurityHeaders(res, origin) {
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}

// ---------------------------------------------------------------------------
// PayPal helpers
// ---------------------------------------------------------------------------
function getPayPalBase() {
  const mode = process.env.PAYPAL_MODE || 'live'
  return mode === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

async function getPayPalToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const secret   = process.env.PAYPAL_SECRET
  if (!clientId || !secret) throw new Error('PayPal credentials not configured')

  const res = await fetch(`${getPayPalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en_US',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000)
  })

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

async function createPayPalOrder(plan, token) {
  const res = await fetch(`${getPayPalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'PayPal-Request-Id': `revsgaming-${Date.now()}`
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: plan.currency, value: plan.amount },
        description: plan.description
      }]
    }),
    signal: AbortSignal.timeout(8000)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal create order failed: ${err}`)
  }
  return res.json()
}

async function capturePayPalOrder(orderID, token) {
  const res = await fetch(`${getPayPalBase()}/v2/checkout/orders/${orderID}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    signal: AbortSignal.timeout(8000)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PayPal capture failed: ${err}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Supabase — activa la suscripción
// ---------------------------------------------------------------------------
async function activateSubscription(email, paypalOrderId, plan, supabaseUrl, serviceKey) {
  const adminHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  }

  // Buscar usuario por email
  let userId = null
  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
      { headers: adminHeaders, signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const body = await res.json()
      const users = body.users || []
      if (users.length > 0) userId = users[0].id
    }
  } catch (e) {
    console.warn('[payment] Could not query Supabase users:', e.message)
  }

  const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString()

  if (userId) {
    const subRes = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id:       userId,
        status:        'active',
        plan:          plan.label,
        expires_at:    expiresAt,
        stripe_sub_id: paypalOrderId   // reutilizamos columna para el ID de PayPal
      }),
      signal: AbortSignal.timeout(6000)
    })
    if (!subRes.ok) console.error('[payment] Subscription upsert failed:', await subRes.text())
    else console.info('[payment] Subscription activated — user:', userId, '| plan:', plan.label)

  } else {
    // Usuario no registrado aún — guardar en pending
    const ppRes = await fetch(`${supabaseUrl}/rest/v1/pending_payments`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        email,
        culqi_charge_id: paypalOrderId,
        paid_at:    new Date().toISOString(),
        expires_at: expiresAt
      }),
      signal: AbortSignal.timeout(6000)
    })
    if (!ppRes.ok) console.error('[payment] Pending payment insert failed:', await ppRes.text())
    else console.info('[payment] Pending payment stored — email:', email)
  }
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  applySecurityHeaders(res, origin)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' })
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Wait a moment and try again.' })

  const body = req.body
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid request body' })

  const supabaseUrl     = process.env.SUPABASE_URL
  const supabaseService = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseService) {
    return res.status(503).json({ error: 'Server configuration error' })
  }

  let token
  try {
    token = await getPayPalToken()
  } catch (e) {
    console.error('[payment] PayPal auth error:', e.message)
    return res.status(503).json({ error: 'Payment service temporarily unavailable' })
  }

  const { action, plan: planKey, orderID, email } = body

  // ── ACTION: create-order ──────────────────────────────────────────────────
  if (action === 'create-order') {
    const plan = PLANS[planKey]
    if (!plan) return res.status(400).json({ error: 'Invalid plan. Use "monthly" or "annual".' })

    try {
      const order = await createPayPalOrder(plan, token)
      return res.status(200).json({ orderID: order.id })
    } catch (e) {
      console.error('[payment] create-order error:', e.message)
      return res.status(502).json({ error: 'Could not create payment order. Try again.' })
    }
  }

  // ── ACTION: capture-order ─────────────────────────────────────────────────
  if (action === 'capture-order') {
    if (!orderID || typeof orderID !== 'string') return res.status(400).json({ error: 'Missing orderID' })
    if (!email || !EMAIL_RE.test(email))         return res.status(400).json({ error: 'Invalid email' })

    const plan = PLANS[planKey]
    if (!plan) return res.status(400).json({ error: 'Invalid plan' })

    let captured
    try {
      captured = await capturePayPalOrder(orderID, token)
    } catch (e) {
      console.error('[payment] capture error:', e.message)
      return res.status(502).json({ error: 'Payment capture failed. Contact support if charged.' })
    }

    // Verificar que el pago realmente completó
    if (captured.status !== 'COMPLETED') {
      console.error('[payment] PayPal order not completed:', captured.status, orderID)
      return res.status(402).json({ error: `Payment not completed (status: ${captured.status})` })
    }

    // Verificar monto cobrado server-side
    const capture = captured.purchase_units?.[0]?.payments?.captures?.[0]
    const paidAmount = capture?.amount?.value
    if (paidAmount !== plan.amount) {
      console.error('[payment] Amount mismatch — expected:', plan.amount, 'got:', paidAmount)
      return res.status(402).json({ error: 'Payment amount mismatch. Contact support.' })
    }

    console.info('[payment] PayPal capture OK — orderID:', orderID, '| email:', email, '| plan:', plan.label)

    // Activar suscripción (no bloquea la respuesta)
    activateSubscription(email, orderID, plan, supabaseUrl, supabaseService).catch(err => {
      console.error('[payment] activateSubscription error (non-fatal):', err.message)
    })

    return res.status(200).json({ success: true, orderID, plan: plan.label })
  }

  return res.status(400).json({ error: 'Unknown action. Use "create-order" or "capture-order".' })
}
