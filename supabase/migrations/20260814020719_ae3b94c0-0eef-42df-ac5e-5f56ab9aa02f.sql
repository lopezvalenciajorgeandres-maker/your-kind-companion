CREATE TABLE public.treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text,
  total_cents integer NOT NULL DEFAULT 0,
  sessions_total integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open',
  notes text,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatments TO authenticated;
GRANT ALL ON public.treatments TO service_role;

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage treatments" ON public.treatments
  FOR ALL TO authenticated
  USING (public.is_member(business_id))
  WITH CHECK (public.is_member(business_id));

CREATE TRIGGER treatments_updated_at BEFORE UPDATE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX treatments_business_client_idx ON public.treatments (business_id, client_id);

ALTER TABLE public.appointments ADD COLUMN treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL;