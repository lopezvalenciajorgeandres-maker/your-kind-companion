DROP VIEW IF EXISTS public.professionals_public;

-- Column-level grants: anon can only read non-sensitive professional columns (no phone/email)
REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (id, business_id, full_name, specialty, photo_url, color, active) ON public.professionals TO anon;

CREATE POLICY "public read professionals" ON public.professionals
FOR SELECT TO anon USING (
  active = true
  AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = professionals.business_id AND b.booking_enabled = true)
);