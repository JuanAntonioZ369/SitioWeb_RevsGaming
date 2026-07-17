-- Tabla para el Libro de Reclamaciones (INDECOPI / Ley N° 29571)
CREATE TABLE IF NOT EXISTS public.reclamaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_caso      text NOT NULL UNIQUE,
  nombres          text NOT NULL,
  tipo_documento   text NOT NULL CHECK (tipo_documento IN ('DNI', 'CE', 'Pasaporte')),
  numero_documento text NOT NULL,
  email            text NOT NULL,
  telefono         text,
  tipo             text NOT NULL CHECK (tipo IN ('reclamo', 'queja')),
  descripcion      text NOT NULL,
  estado           text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto')),
  respuesta        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS: solo service_role puede leer/escribir (el API usa service_role)
ALTER TABLE public.reclamaciones ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS reclamaciones_email_idx ON public.reclamaciones(email);
CREATE INDEX IF NOT EXISTS reclamaciones_created_at_idx ON public.reclamaciones(created_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_reclamaciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER reclamaciones_updated_at
  BEFORE UPDATE ON public.reclamaciones
  FOR EACH ROW EXECUTE FUNCTION update_reclamaciones_updated_at();
