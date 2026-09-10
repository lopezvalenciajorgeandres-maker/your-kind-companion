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

-- 2. Safe public projection for the booking page
CREATE OR REPLACE VIEW public.professionals_public
WITH (security_invoker = false) AS
SELECT p.id, p.business_id, p.full_name, p.specialty, p.photo_url, p.color
FROM public.professionals p
JOIN public.businesses b ON b.id = p.business_id
WHERE p.active = true AND b.booking_enabled = true;

GRANT SELECT ON public.professionals_public TO anon, authenticated;

-- 3. SECURITY DEFINER helpers are only used inside RLS policies / triggers: no direct API access
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_business_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_active_professional(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;