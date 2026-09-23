-- Ficha de valoracion: mide como inicia y como termina el cliente su tratamiento.
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  stage text NOT NULL CHECK (stage IN ('inicial', 'final')),
  category text NOT NULL DEFAULT 'corporal'
    CHECK (category IN ('corporal', 'laser', 'facial', 'postquirurgico')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  body_fat_pct numeric(5,2),
  muscle_mass_pct numeric(5,2),
  blood_pressure text,
  bust_cm numeric(6,2),
  chest_cm numeric(6,2),
  waist_cm numeric(6,2),
  upper_abdomen_cm numeric(6,2),
  lower_abdomen_cm numeric(6,2),
  hip_cm numeric(6,2),
  gluteus_cm numeric(6,2),
  thigh_left_cm numeric(6,2),
  thigh_right_cm numeric(6,2),
  calf_left_cm numeric(6,2),
  calf_right_cm numeric(6,2),
  arm_left_cm numeric(6,2),
  arm_right_cm numeric(6,2),
  back_cm numeric(6,2),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  photo_front text,
  photo_side text,
  photo_back text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX assessments_treatment_stage_idx
  ON public.assessments (treatment_id, stage)
  WHERE treatment_id IS NOT NULL;
CREATE INDEX assessments_business_client_idx ON public.assessments (business_id, client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage assessments" ON public.assessments
  FOR ALL TO authenticated
  USING (public.is_member(business_id))
  WITH CHECK (public.is_member(business_id));

CREATE TRIGGER assessments_updated_at BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
