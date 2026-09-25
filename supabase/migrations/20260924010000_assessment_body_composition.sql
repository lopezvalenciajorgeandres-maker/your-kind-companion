-- Datos necesarios para estimar automaticamente % de grasa y masa muscular.
-- El perimetro del cuello es la medida que exige el metodo U.S. Navy;
-- edad y sexo permiten ademas el respaldo por IMC (Deurenberg).
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS neck_cm numeric(6,2),
  ADD COLUMN IF NOT EXISTS age_years integer,
  ADD COLUMN IF NOT EXISTS sex text;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_sex_check;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_sex_check CHECK (sex IS NULL OR sex IN ('F', 'M'));
