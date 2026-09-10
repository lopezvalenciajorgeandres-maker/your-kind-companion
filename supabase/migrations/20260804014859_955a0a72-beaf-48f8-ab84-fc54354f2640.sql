
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
