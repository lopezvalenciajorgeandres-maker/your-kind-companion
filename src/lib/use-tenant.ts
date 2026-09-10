import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/business.functions";
import { FALLBACK_LIMITS, type FeatureKey, type PlanLimits, type PlanTier, hasFeature } from "@/lib/plan";

export function useTenant() {
  const fn = useServerFn(getMyContext);
  const query = useQuery({ queryKey: ["tenant"], queryFn: () => fn(), staleTime: 30_000 });

  const business = query.data?.business ?? null;
  const plan = (business?.plan ?? "free") as PlanTier;
  const row = (query.data?.limits ?? []).find((l) => l.plan === plan);
  const limits: PlanLimits = row
    ? {
        plan,
        max_clients: row.max_clients,
        max_services: row.max_services,
        max_professionals: row.max_professionals,
        max_appointments_per_month: row.max_appointments_per_month,
        price_cents: row.price_cents,
        features: (row.features ?? {}) as PlanLimits["features"],
      }
    : FALLBACK_LIMITS[plan];

  return {
    ...query,
    business,
    profile: query.data?.profile ?? null,
    counts: query.data?.counts ?? null,
    role: query.data?.member?.role ?? null,
    plan,
    limits,
    currency: business?.currency ?? "EUR",
    can: (key: FeatureKey) => hasFeature(limits, key),
  };
}
