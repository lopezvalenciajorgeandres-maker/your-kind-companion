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

-- 1. Remove anonymous access to full professionals table (PII: phone/email)
DROP POLICY IF EXISTS "public read professionals" ON public.professionals;
REVOKE SELECT ON public.professionals FROM anon;

-- helper so the professional_services public policy still works without anon reading professionals
CREATE OR REPLACE FUNCTION public.is_active_professional(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.professionals WHERE id = _id AND active = true)
$$;

DROP POLICY IF EXISTS "public read prof services" ON public.professional_services;
CREATE POLICY "public read prof services" ON public.professional_services
FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = professional_services.business_id AND b.booking_enabled = true)
  AND public.is_active_professional(professional_services.professional_id)
  AND EXISTS (SELECT 1 FROM public.services s WHERE s.id = professional_services.service_id AND s.active = true)
);

-- 3. SECURITY DEFINER helpers are only used inside RLS policies / triggers: no direct API access
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_business_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_active_professional(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Column-level grants: anon can only read non-sensitive professional columns (no phone/email)
REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (id, business_id, full_name, specialty, photo_url, color, active) ON public.professionals TO anon;

CREATE POLICY "public read professionals" ON public.professionals
FOR SELECT TO anon USING (
  active = true
  AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = professionals.business_id AND b.booking_enabled = true)
);

GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_professional(uuid) TO authenticated, anon;