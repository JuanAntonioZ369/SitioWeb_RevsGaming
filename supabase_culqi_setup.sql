-- ================================================================
-- supabase_culqi_setup.sql
-- Conecta el pago de Culqi (web) con el sistema de suscripciones de la app
--
-- Ejecuta este archivo en: Supabase → SQL Editor → New Query
--
-- Qué hace:
--   1. Agrega restricción única en subscriptions(user_id) para upserts seguros
--   2. Crea tabla pending_payments para usuarios que pagan ANTES de registrarse
--   3. Crea un trigger en auth.users que activa la suscripción automáticamente
--      cuando el usuario se registra en la app después de haber pagado
-- ================================================================


-- ── 1. Restricción única en subscriptions(user_id) ───────────────
-- Necesaria para el UPSERT (ON CONFLICT) desde el backend de pago.
-- Si ya existe la restricción, esta línea no hace nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_user_id_key'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;


-- ── 2. Tabla pending_payments ────────────────────────────────────
-- Guarda el pago de usuarios que todavía no tienen cuenta en la app.
-- El trigger de abajo la procesa al momento del registro.
CREATE TABLE IF NOT EXISTS pending_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  culqi_charge_id text NOT NULL,
  paid_at         timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,           -- fecha de vencimiento a copiar en subscriptions
  processed_at    timestamptz            -- NULL = pendiente, NOT NULL = ya activado
);

-- Índice para búsqueda rápida por email en el trigger
CREATE INDEX IF NOT EXISTS pending_payments_email_idx ON pending_payments(email);

-- RLS: nadie puede leer ni escribir desde el cliente (solo service_role)
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
-- Sin políticas = solo service_role tiene acceso


-- ── 3. Función del trigger ───────────────────────────────────────
-- Se ejecuta cada vez que un nuevo usuario se registra.
-- Si hay un pago pendiente con ese email, activa la suscripción inmediatamente.
CREATE OR REPLACE FUNCTION handle_pending_payment_on_register()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER   -- corre como superuser, puede bypassear RLS
SET search_path = public
AS $$
BEGIN
  -- Buscar si hay un pago pendiente (no procesado) para este email
  IF EXISTS (
    SELECT 1 FROM pending_payments
    WHERE email = NEW.email AND processed_at IS NULL
  ) THEN

    -- Activar suscripción anual para el nuevo usuario
    -- Usa expires_at guardado en el pago pendiente (1 año desde cuando pagó)
    INSERT INTO subscriptions (user_id, status, plan, expires_at, stripe_sub_id)
    SELECT
      NEW.id,
      'active',
      'annual',
      COALESCE(pp.expires_at, now() + interval '1 year'),
      pp.culqi_charge_id
    FROM pending_payments pp
    WHERE pp.email = NEW.email AND pp.processed_at IS NULL
    LIMIT 1
    ON CONFLICT (user_id) DO UPDATE SET
      status     = 'active',
      plan       = 'annual',
      expires_at = COALESCE(EXCLUDED.expires_at, now() + interval '1 year'),
      updated_at = now();

    -- Marcar el pago pendiente como procesado
    UPDATE pending_payments
    SET processed_at = now()
    WHERE email = NEW.email AND processed_at IS NULL;

  END IF;

  RETURN NEW;
END;
$$;

-- Registrar el trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_activate_payment ON auth.users;
CREATE TRIGGER on_auth_user_created_activate_payment
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_pending_payment_on_register();


-- ================================================================
-- VERIFICACIÓN (ejecuta esto después para comprobar que todo quedó bien)
-- ================================================================
--
-- SELECT conname FROM pg_constraint WHERE conname = 'subscriptions_user_id_key';
-- -- Debe devolver: subscriptions_user_id_key
--
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'pending_payments';
-- -- Debe devolver: pending_payments
--
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created_activate_payment';
-- -- Debe devolver: on_auth_user_created_activate_payment
-- ================================================================
