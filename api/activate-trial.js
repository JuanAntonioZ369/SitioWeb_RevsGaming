/**
 * RevsGaming — Activate Trial API (Vercel Serverless Function)
 * Endpoint: POST /api/activate-trial
 *
 * Activa 2 meses de prueba gratis para un usuario recién registrado.
 *
 * Seguridad:
 *   • CORS whitelist
 *   • Solo POST
 *   • Rate limiting 5/min por IP
 *   • Verifica que el userId exista en Supabase
 *   • Verifica que la cuenta fue creada hace menos de 10 minutos (evita abusos)
 *   • Si ya tiene suscripción activa (ej: pagó antes de registrarse), NO sobreescribe
 */

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

const ALLOWED_ORIGINS = new Set([
  'https://revsgaming.com',
  'https://www.revsgaming.com',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
])

function applySecurityHeaders(res, origin) {
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  applySecurityHeaders(res, origin)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Método no permitido' })

  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type debe ser application/json' })
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera un momento.' })
  }

  const { userId } = req.body || {}
  if (!userId || typeof userId !== 'string' || !/^[0-9a-f-]{36}$/.test(userId)) {
    return res.status(400).json({ error: 'userId inválido' })
  }

  const supabaseUrl     = process.env.SUPABASE_URL
  const supabaseService = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseService) {
    return res.status(503).json({ error: 'Error de configuración del servidor' })
  }

  const adminHeaders = {
    'apikey':        supabaseService,
    'Authorization': `Bearer ${supabaseService}`,
    'Content-Type':  'application/json'
  }

  // ── 1. Verificar que el usuario existe y fue creado recientemente ──────────
  let user
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: adminHeaders,
      signal: AbortSignal.timeout(6000)
    })
    if (!r.ok) return res.status(404).json({ error: 'Usuario no encontrado' })
    user = await r.json()
  } catch {
    return res.status(502).json({ error: 'No se pudo verificar el usuario' })
  }

  // Seguridad: solo activar trial si la cuenta tiene menos de 10 minutos
  const createdAt = new Date(user.created_at).getTime()
  const ageMs     = Date.now() - createdAt
  if (ageMs > 10 * 60 * 1000) {
    return res.status(403).json({ error: 'El período de activación del trial ha expirado' })
  }

  // ── 2. Verificar que NO tenga ya una suscripción activa ───────────────────
  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active&limit=1`,
      { headers: adminHeaders, signal: AbortSignal.timeout(6000) }
    )
    if (r.ok) {
      const existing = await r.json()
      if (existing.length > 0) {
        // Ya tiene suscripción activa (ej: pagó antes de registrarse)
        return res.status(200).json({
          success:   true,
          alreadyActive: true,
          plan:      existing[0].plan,
          expiresAt: existing[0].expires_at
        })
      }
    }
  } catch { /* si falla la verificación, continuamos con activación */ }

  // ── 3. Activar trial: 2 meses (60 días) ──────────────────────────────────
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id:    userId,
        status:     'active',
        plan:       'trial',
        expires_at: expiresAt,
        stripe_sub_id: 'trial'
      }),
      signal: AbortSignal.timeout(6000)
    })

    if (!r.ok) {
      const text = await r.text()
      console.error('[activate-trial] Supabase upsert failed:', text)
      return res.status(500).json({ error: 'No se pudo activar el trial' })
    }
  } catch (e) {
    console.error('[activate-trial] Error:', e.message)
    return res.status(500).json({ error: 'Error al activar el trial' })
  }

  console.info('[activate-trial] Trial activated for user:', userId, '| expires:', expiresAt)
  return res.status(200).json({ success: true, expiresAt })
}
