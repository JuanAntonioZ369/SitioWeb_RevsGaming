# RevsGaming — Sitio Web Oficial

Sitio web de [RevsGaming](https://revsgaming.com), el launcher de juegos retro para Windows con netplay online, cloud saves y soporte para PS1, NES, SNES, GBA, N64 y más.

## Stack

| Capa | Tecnología |
|------|-----------|
| Hosting | [Vercel](https://vercel.com) (estático + serverless) |
| Backend de pagos | Vercel Serverless Function (`api/payment.js`) |
| Pagos | [Culqi](https://culqi.com) (procesador peruano, PEN) |
| Base de datos / Auth | [Supabase](https://supabase.com) |
| DNS / Dominio | Hostinger |

## Estructura

```
SitioWeb_RevsGaming/
├── index.html              ← Landing principal
├── register.html           ← Registro de cuenta + pago
├── account.html            ← Panel de usuario / suscripción
├── success.html            ← Confirmación post-pago
├── forgot-password.html    ← Recuperación de contraseña
├── reset-password.html     ← Nueva contraseña (via email)
├── changelog/index.html    ← Historial de versiones
├── docs/index.html         ← Documentación
├── legal/
│   ├── privacy.html
│   └── terms.html
├── api/
│   └── payment.js          ← Serverless: cobra con Culqi, activa suscripción en Supabase
├── vercel.json             ← Config de Vercel (rutas, headers de seguridad, CSP)
├── robots.txt
├── sitemap.xml
├── supabase_culqi_setup.sql ← SQL para configurar Supabase (ejecutar una vez)
└── package.json
```

## Variables de entorno (Vercel)

Configurar en **Vercel → Settings → Environment Variables**:

| Variable | Descripción |
|----------|-------------|
| `CULQI_SECRET_KEY` | Clave secreta de Culqi (`sk_live_XXXX`) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key de Supabase (bypasea RLS) |

> ⚠️ Nunca subas estas claves al repositorio.

## Planes de pago

| Plan | Precio base | + IGV (18%) | Total |
|------|------------|-------------|-------|
| Mensual | S/ 10.00 | S/ 1.80 | **S/ 11.80** |
| Anual | S/ 100.00 | S/ 18.00 | **S/ 118.00** |

Para cambiar precios: editar `PLANS` en `api/payment.js` (los precios en el HTML son solo display — el backend nunca confía en el monto del cliente).

## Setup de Supabase

Ejecutar `supabase_culqi_setup.sql` una vez en el SQL Editor de Supabase. Crea:
- Restricción UNIQUE en `subscriptions(user_id)`
- Tabla `pending_payments` (para pagos antes de registro)
- Trigger que activa suscripción automáticamente cuando el usuario se registra en la app

## Deploy

1. Conectar este repo en [vercel.com](https://vercel.com)
2. Framework Preset: **Other**
3. Build Command: *(vacío)*
4. Output Directory: *(vacío)*
5. Agregar las 3 variables de entorno
6. Apuntar DNS en Hostinger: `A @ → 76.76.21.21` y `CNAME www → cname.vercel-dns.com`

## App de escritorio

El launcher de RevsGaming para Windows está en un repositorio separado:
[github.com/JuanAntonioZ369/RetroGamingRevs_2.0](https://github.com/JuanAntonioZ369/RetroGamingRevs_2.0)

## Licencia

© 2026 RevsGaming. Todos los derechos reservados.
