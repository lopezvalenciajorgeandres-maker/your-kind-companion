
DROP POLICY IF EXISTS "authenticated create business" ON public.businesses;

DROP POLICY IF EXISTS "public read blocks" ON public.blocked_dates;
CREATE POLICY "public read blocks" ON public.blocked_dates
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = blocked_dates.business_id AND b.booking_enabled = true));

DROP POLICY IF EXISTS "public read hours" ON public.business_hours;
CREATE POLICY "public read hours" ON public.business_hours
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_hours.business_id AND b.booking_enabled = true));

DROP POLICY IF EXISTS "public read prof services" ON public.professional_services;
CREATE POLICY "public read prof services" ON public.professional_services
FOR SELECT TO anon
USING (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = professional_services.business_id AND b.booking_enabled = true)
  AND EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_services.professional_id AND p.active = true)
  AND EXISTS (SELECT 1 FROM public.services s WHERE s.id = professional_services.service_id AND s.active = true)
);

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_business_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (id, business_id, full_name, specialty, photo_url, active) ON public.professionals TO anon;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bank text;

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Otro',
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  method text NOT NULL DEFAULT 'Efectivo',
  supplier text,
  spent_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage business expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (public.is_member(business_id))
  WITH CHECK (public.is_member(business_id));

CREATE INDEX expenses_business_date_idx ON public.expenses (business_id, spent_at DESC);

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();