
CREATE TYPE public.app_role AS ENUM ('platform_admin', 'user');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE public.plan_tier AS ENUM ('free', 'pro');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  first_name text,
  last_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile all" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type text NOT NULL DEFAULT 'otro',
  description text,
  city text,
  country text,
  address text,
  phone text,
  whatsapp text,
  instagram text,
  website text,
  logo_url text,
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  currency text NOT NULL DEFAULT 'EUR',
  plan public.plan_tier NOT NULL DEFAULT 'free',
  subscription_status text NOT NULL DEFAULT 'free',
  booking_enabled boolean NOT NULL DEFAULT true,
  onboarding_step integer NOT NULL DEFAULT 0,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = auth.uid() AND role IN ('owner','admin')
  )
$$;

CREATE POLICY "members read own memberships" ON public.business_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(business_id));
CREATE POLICY "admins manage members" ON public.business_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_business_admin(business_id));
CREATE POLICY "admins update members" ON public.business_members FOR UPDATE TO authenticated
  USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));
CREATE POLICY "admins delete members" ON public.business_members FOR DELETE TO authenticated
  USING (public.is_business_admin(business_id));

CREATE POLICY "members read business" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_member(id));
CREATE POLICY "public read business" ON public.businesses FOR SELECT TO anon
  USING (booking_enabled = true);
CREATE POLICY "authenticated create business" ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "admins update business" ON public.businesses FOR UPDATE TO authenticated
  USING (public.is_business_admin(id)) WITH CHECK (public.is_business_admin(id));
CREATE POLICY "admins delete business" ON public.businesses FOR DELETE TO authenticated
  USING (public.is_business_admin(id));

INSERT INTO public.businesses (id, slug, name, address, website, instagram, phone, onboarded, onboarding_step)
SELECT
  gen_random_uuid(),
  'negocio-' || substr(replace(u.owner_id::text, '-', ''), 1, 12),
  COALESCE(bp.business_name, 'Mi negocio'),
  bp.address, bp.website, bp.instagram, bp.contact_phone,
  COALESCE(bp.onboarded, false),
  CASE WHEN COALESCE(bp.onboarded, false) THEN 5 ELSE 0 END
FROM (
  SELECT user_id AS owner_id FROM public.business_profiles
  UNION SELECT owner_id FROM public.clients
  UNION SELECT owner_id FROM public.services
  UNION SELECT owner_id FROM public.appointments
) u
LEFT JOIN public.business_profiles bp ON bp.user_id = u.owner_id;

INSERT INTO public.business_members (business_id, user_id, role)
SELECT b.id, u.owner_id, 'owner'
FROM (
  SELECT user_id AS owner_id FROM public.business_profiles
  UNION SELECT owner_id FROM public.clients
  UNION SELECT owner_id FROM public.services
  UNION SELECT owner_id FROM public.appointments
) u
JOIN public.businesses b
  ON b.slug = 'negocio-' || substr(replace(u.owner_id::text, '-', ''), 1, 12);

INSERT INTO public.profiles (user_id, first_name)
SELECT bp.user_id, bp.owner_name FROM public.business_profiles bp
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  specialty text,
  phone text,
  email text,
  photo_url text,
  color text NOT NULL DEFAULT '#CDB4DB',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT SELECT ON public.professionals TO anon;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage professionals" ON public.professionals FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE POLICY "public read professionals" ON public.professionals FOR SELECT TO anon
  USING (active = true);
CREATE TRIGGER professionals_updated_at BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clients ADD COLUMN business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.services ADD COLUMN business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

UPDATE public.clients c SET business_id = m.business_id
  FROM public.business_members m WHERE m.user_id = c.owner_id;
UPDATE public.services s SET business_id = m.business_id
  FROM public.business_members m WHERE m.user_id = s.owner_id;
UPDATE public.appointments a SET business_id = m.business_id
  FROM public.business_members m WHERE m.user_id = a.owner_id;

DELETE FROM public.appointments WHERE business_id IS NULL;
DELETE FROM public.clients WHERE business_id IS NULL;
DELETE FROM public.services WHERE business_id IS NULL;

ALTER TABLE public.clients ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.services ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE public.clients ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.services ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.clients
  ADD COLUMN last_name text,
  ADD COLUMN whatsapp text,
  ADD COLUMN birthdate date,
  ADD COLUMN gender text,
  ADD COLUMN address text,
  ADD COLUMN source text;

ALTER TABLE public.services
  ADD COLUMN description text,
  ADD COLUMN category text,
  ADD COLUMN professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  ADD COLUMN price_cents integer,
  ADD COLUMN origin text NOT NULL DEFAULT 'panel';

DROP POLICY IF EXISTS "own clients select" ON public.clients;
DROP POLICY IF EXISTS "own clients insert" ON public.clients;
DROP POLICY IF EXISTS "own clients update" ON public.clients;
DROP POLICY IF EXISTS "own clients delete" ON public.clients;
CREATE POLICY "members manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));

DROP POLICY IF EXISTS "own services select" ON public.services;
DROP POLICY IF EXISTS "own services insert" ON public.services;
DROP POLICY IF EXISTS "own services update" ON public.services;
DROP POLICY IF EXISTS "own services delete" ON public.services;
CREATE POLICY "members manage services" ON public.services FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE POLICY "public read services" ON public.services FOR SELECT TO anon
  USING (active = true);
GRANT SELECT ON public.services TO anon;

DROP POLICY IF EXISTS "own appointments select" ON public.appointments;
DROP POLICY IF EXISTS "own appointments insert" ON public.appointments;
DROP POLICY IF EXISTS "own appointments update" ON public.appointments;
DROP POLICY IF EXISTS "own appointments delete" ON public.appointments;
CREATE POLICY "members manage appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));

CREATE INDEX idx_clients_business ON public.clients(business_id);
CREATE INDEX idx_services_business ON public.services(business_id);
CREATE INDEX idx_appointments_business_start ON public.appointments(business_id, starts_at);

CREATE TABLE public.professional_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professional_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;
GRANT SELECT ON public.professional_services TO anon;
GRANT ALL ON public.professional_services TO service_role;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage prof services" ON public.professional_services FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE POLICY "public read prof services" ON public.professional_services FOR SELECT TO anon USING (true);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  total_cents integer,
  method text NOT NULL DEFAULT 'efectivo',
  status text NOT NULL DEFAULT 'pagado',
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_payments_business_date ON public.payments(business_id, paid_at);

CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '19:00',
  break_start time,
  break_end time,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT SELECT ON public.business_hours TO anon;
GRANT ALL ON public.business_hours TO service_role;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hours" ON public.business_hours FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE POLICY "public read hours" ON public.business_hours FOR SELECT TO anon USING (true);
CREATE TRIGGER business_hours_updated_at BEFORE UPDATE ON public.business_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  kind text NOT NULL DEFAULT 'bloqueo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_dates TO authenticated;
GRANT SELECT ON public.blocked_dates TO anon;
GRANT ALL ON public.blocked_dates TO service_role;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage blocks" ON public.blocked_dates FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE POLICY "public read blocks" ON public.blocked_dates FOR SELECT TO anon USING (true);

CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage client notes" ON public.client_notes FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));

CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  sessions_total integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage packages" ON public.packages FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE TRIGGER packages_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.package_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_sessions TO authenticated;
GRANT ALL ON public.package_sessions TO service_role;
ALTER TABLE public.package_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage package sessions" ON public.package_sessions FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (business_id IS NOT NULL AND public.is_member(business_id));

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  metadata jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage integrations" ON public.integrations FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by uuid,
  size_bytes integer NOT NULL DEFAULT 0,
  destination text NOT NULL DEFAULT 'download',
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage backups" ON public.backups FOR ALL TO authenticated
  USING (public.is_member(business_id)) WITH CHECK (public.is_member(business_id));

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'free',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_member(business_id));
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.plan_limits (
  plan public.plan_tier PRIMARY KEY,
  max_clients integer,
  max_services integer,
  max_professionals integer,
  max_appointments_per_month integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT SELECT ON public.plan_limits TO anon;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read plan limits" ON public.plan_limits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "platform admin manage plan limits" ON public.plan_limits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

INSERT INTO public.plan_limits (plan, max_clients, max_services, max_professionals, max_appointments_per_month, price_cents, features) VALUES
  ('free', 200, 20, 1, 300, 0, '{"agenda":true,"clientes":true,"servicios":true,"pagos":true,"historial":true,"reserva_online":true,"whatsapp_manual":true,"export_excel":true,"backups":true,"dashboard_basico":true}'::jsonb),
  ('pro', NULL, NULL, NULL, NULL, 2900, '{"agenda":true,"clientes":true,"servicios":true,"pagos":true,"historial":true,"reserva_online":true,"whatsapp_manual":true,"export_excel":true,"backups":true,"dashboard_basico":true,"recordatorios_automaticos":true,"whatsapp_automatico":true,"dashboard_financiero":true,"dashboard_avanzado":true,"reactivacion":true,"embudo":true,"profesionales":true,"paquetes":true,"reportes_avanzados":true,"rentabilidad":true,"automatizaciones":true,"eleva_ai":true}'::jsonb);

INSERT INTO public.subscriptions (business_id) SELECT id FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;
