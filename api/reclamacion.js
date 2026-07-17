/**
 * RevsGaming — Libro de Reclamaciones API
 * POST /api/reclamacion
 * Guarda la reclamación en Supabase tabla `reclamaciones`
 */

const ALLOWED_ORIGINS = new Set([
  'https://revsgaming.com', 'https://www.revsgaming.com',
  'http://localhost:3000', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501'
])

export default async function handler(req, res) {
  const origin = req.headers['origin'] || ''
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { nombres, tipoDocumento, numeroDocumento, email, telefono, tipo, descripcion } = req.body || {}

  // Validación básica
  if (!nombres || !tipoDocumento || !numeroDocumento || !email || !tipo || !descripcion) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }
  if (descripcion.length < 20) return res.status(400).json({ error: 'La descripción es muy corta' })
  if (descripcion.length > 1000) return res.status(400).json({ error: 'La descripción es muy larga' })
  if (!['reclamo', 'queja'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' })

  const supabaseUrl     = process.env.SUPABASE_URL
  const supabaseService = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseService) return res.status(503).json({ error: 'Error de configuración' })

  // Generar número de caso: REC-YYYYMMDD-XXXX
  const now = new Date()
  const dateStr = now.toISOString().slice(0,10).replace(/-/g,'')
  const random = Math.floor(1000 + Math.random() * 9000)
  const numeroCaso = `REC-${dateStr}-${random}`

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/reclamaciones`, {
      method: 'POST',
      headers: {
        'apikey': supabaseService,
        'Authorization': `Bearer ${supabaseService}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        numero_caso:      numeroCaso,
        nombres:          nombres.slice(0, 200),
        tipo_documento:   tipoDocumento,
        numero_documento: numeroDocumento.slice(0, 20),
        email:            email.slice(0, 320),
        telefono:         (telefono || '').slice(0, 20),
        tipo,
        descripcion:      descripcion.slice(0, 1000),
        created_at:       now.toISOString()
      }),
      signal: AbortSignal.timeout(6000)
    })

    if (!r.ok) {
      const text = await r.text()
      console.error('[reclamacion] Supabase insert failed:', text)
      return res.status(500).json({ error: 'No se pudo registrar la reclamación. Intenta de nuevo.' })
    }

    console.info('[reclamacion] Reclamación registrada:', numeroCaso)
    return res.status(200).json({ success: true, numeroCaso })

  } catch (e) {
    console.error('[reclamacion] Error:', e.message)
    return res.status(500).json({ error: 'Error de conexión. Intenta de nuevo.' })
  }
}
