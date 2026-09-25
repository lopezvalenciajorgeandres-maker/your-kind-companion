-- Informe de cierre del tratamiento: una version para el cliente y otra
-- para la esteticista. Se guardan en la ficha final, unica por tratamiento.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS report_client text,
  ADD COLUMN IF NOT EXISTS report_staff text,
  ADD COLUMN IF NOT EXISTS report_at timestamptz;
