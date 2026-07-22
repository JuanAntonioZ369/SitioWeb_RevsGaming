/**
 * RevsGaming — Payment API (Vercel Serverless Function)
 * Endpoint: POST /api/payment
 *
 * Planes disponibles:
 *   monthly — S/14.90 PEN (30 días)
 *   annual  — S/135.60 PEN (365 días)
 *
 * Flujo completo:
 *   1. Valida el token de Culqi generado por el checkout del frontend
 *   2. Cobra el monto del plan usando la clave secreta de Culqi (server-side)
 *   3. Busca al usuario en Supabase por email
 *      a. Si existe → activa su suscripción (status = 'active')
 *      b. Si no existe → guarda en pending_payments; el trigger de Supabase
 *         la activará automáticamente cuando el usuario se registre en la app
 *
 * Variables de entorno requeridas en Vercel:
 *   CULQI_SECRET_KEY      → sk_live_XXXX (panel de Culqi → API Keys)
 *   SUPABASE_URL          → https://kyoyunuwfuujqdomdmlh.supabase.co
 *   SUPABASE_SERVICE_KEY  → service_role key (Supabase → Settings → API)
 *
 * Capas de seguridad:
 *   • CORS whitelist (solo revsgaming.com)
 *   • Solo POST permitido
 *   • Rate limiting por IP (5 intentos/minuto)
 *   • Validación de formato de token Culqi y email
 *   • Plan validado server-side (cliente nunca controla el precio)
 *   • Monto hardcodeado por plan (cliente no puede enviar el monto)
 *   • Validación del resultado del cargo (outcome.type = venta_exitosa)
 *   • Errores sanitizados (no se filtran detalles internos al cliente)
 *   • Timeout de 9s a APIs externas
 */

// ---------------------------------------------------------------------------
// Planes — hardcodeados en el servidor (el cliente NUNCA controla el precio)
// ---------------------------------------------------------------------------
const PLANS = {
  monthly: {
    amount:      299,                                  // $2.99 USD
    days:        30,
    description: 'RevsGaming — Monthly Access',
    label:       'monthly'
  },
  annual: {
    amount:      2999,                                 // $29.99 USD
    days:        365,
    description: 'RevsGaming — Annual Access',
    label:       'annual'
  }
}

// ---------------------------------------------------------------------------
// Rate limiter — sliding window en memoria
// ---------------------------------------------------------------------------
const rateLimitStore = new Map()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX       = 5

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
// Validadores de entrada
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/
const TOKEN_RE = /^tkn_[a-zA-Z0-9_]{10,80}$/

const isValidEmail = v => typeof v === 'string' && EMAIL_RE.test(v) && v.length <= 320
const isValidToken = v => typeof v === 'string' && TOKEN_RE.test(v)

// ---------------------------------------------------------------------------
// Orígenes permitidos (CORS)
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
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}

// ---------------------------------------------------------------------------
// Supabase — activa la suscripción usando service_role (bypasea RLS)
// ---------------------------------------------------------------------------
async function activateSubscription(email, chargeId, plan, supabaseUrl, serviceKey) {
  const adminHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  }

  // Paso 1: buscar usuario por email en auth.users
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
    console.warn('[payment] Could not query Supabase admin users:', e.message)
  }

  // Fecha de expiración según el plan
  const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString()

  if (userId) {
    // Paso 2a: usuario existe → activar o renovar suscripción
    // Si ya tenía suscripción activa, extiende desde HOY (no acumula desde la fecha anterior)
    const subRes = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        user_id:       userId,
        status:        'active',
        plan:          plan.label,
        expires_at:    expiresAt,
        stripe_sub_id: chargeId   // reutilizamos la columna para el ID de Culqi
      }),
      signal: AbortSignal.timeout(6000)
    })

    if (!subRes.ok) {
      const text = await subRes.text()
      console.error('[payment] Supabase subscription upsert failed:', text)
    } else {
      console.info('[payment] Subscription activated — user:', userId, '| plan:', plan.label)
    }

  } else {
    // Paso 2b: usuario no existe aún → guardar en pending_payments
    const ppRes = await fetch(`${supabaseUrl}/rest/v1/pending_payments`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        email,
        culqi_charge_id: chargeId,
        paid_at:    new Date().toISOString(),
        expires_at: expiresAt
      }),
      signal: AbortSignal.timeout(6000)
    })

    if (!ppRes.ok) {
      const text = await ppRes.text()
      console.error('[payment] Supabase pending_payments insert failed:', text)
    } else {
      console.info('[payment] Pending payment stored — email:', email, '| plan:', plan.label)
    }
  }
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  applySecurityHeaders(res, origin)

  // Preflight CORS
  if (req.method === 'OPTIONS') return res.status(204).end()

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  // Content-Type
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type debe ser application/json' })
  }

  // IP para rate limiting
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
    })
  }

  // Extraer body
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Cuerpo de solicitud inválido' })
  }

  const { token, email, plan: planKey } = body

  // Validaciones básicas
  if (!token || !email) return res.status(400).json({ error: 'Faltan datos requeridos' })
  if (!isValidToken(token))  return res.status(400).json({ error: 'Token de pago inválido' })
  if (!isValidEmail(email))  return res.status(400).json({ error: 'Email inválido' })

  // Validar plan — hardcodeado: cliente nunca decide el precio
  const plan = PLANS[planKey]
  if (!plan) {
    return res.status(400).json({ error: 'Plan no válido. Usa "monthly" o "annual".' })
  }

  // Verificar variables de entorno
  const culqiSecret     = process.env.CULQI_SECRET_KEY
  const supabaseUrl     = process.env.SUPABASE_URL
  const supabaseService = process.env.SUPABASE_SERVICE_KEY

  if (!culqiSecret || !culqiSecret.startsWith('sk_live_')) {
    console.error('[payment] CULQI_SECRET_KEY missing or not a live key')
    return res.status(503).json({ error: 'Servicio de pagos temporalmente no disponible' })
  }
  if (!supabaseUrl || !supabaseService) {
    console.error('[payment] SUPABASE_URL or SUPABASE_SERVICE_KEY missing')
    return res.status(503).json({ error: 'Error de configuración del servidor' })
  }

  // ── Cobrar via Culqi ──────────────────────────────────────────────────────
  let culqiResponse
  try {
    culqiResponse = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${culqiSecret}`
      },
      body: JSON.stringify({
        amount:        plan.amount,        // hardcodeado según plan — NUNCA del cliente
        currency_code: 'USD',
        email,
        source_id:     token,
        capture:       true,
        description:   plan.description
      }),
      signal: AbortSignal.timeout(9000)
    })
  } catch (e) {
    console.error('[payment] Network error contacting Culqi:', e.message)
    return res.status(502).json({ error: 'No se pudo conectar con el procesador de pagos. Intenta de nuevo.' })
  }

  let chargeData
  try {
    chargeData = await culqiResponse.json()
  } catch {
    return res.status(502).json({ error: 'Respuesta inesperada del procesador de pagos' })
  }

  // Validar resultado real del cargo
  if (!culqiResponse.ok || chargeData?.outcome?.type !== 'venta_exitosa') {
    const userMessage =
      chargeData?.user_message ||
      chargeData?.merchant_message ||
      'El pago no pudo procesarse. Verifica tu tarjeta e intenta nuevamente.'
    console.error('[payment] Charge failed:', chargeData?.code, chargeData?.decline_code)
    return res.status(402).json({ error: userMessage })
  }

  console.info('[payment] Charge OK — id:', chargeData.id, '| email:', email, '| plan:', plan.label)

  // ── Activar suscripción en Supabase ──────────────────────────────────────
  // No bloqueamos la respuesta al usuario si Supabase falla — el cobro ya se hizo.
  activateSubscription(email, chargeData.id, plan, supabaseUrl, supabaseService).catch(err => {
    console.error('[payment] activateSubscription error (non-fatal):', err.message)
  })

  return res.status(200).json({
    success:  true,
    chargeId: chargeData.id,
    plan:     plan.label
  })
}
