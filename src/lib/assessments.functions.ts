import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";

export type AssessmentStage = "inicial" | "final";
export type AssessmentCategory = "corporal" | "laser" | "facial" | "postquirurgico";

/** Medidas corporales en centímetros, comunes a todas las especialidades. */
export const MEASURE_FIELDS = [
  "neck_cm",
  "bust_cm",
  "chest_cm",
  "waist_cm",
  "upper_abdomen_cm",
  "lower_abdomen_cm",
  "hip_cm",
  "gluteus_cm",
  "thigh_left_cm",
  "thigh_right_cm",
  "calf_left_cm",
  "calf_right_cm",
  "arm_left_cm",
  "arm_right_cm",
  "back_cm",
] as const;

export type MeasureField = (typeof MEASURE_FIELDS)[number];

export type Assessment = {
  id: string;
  client_id: string;
  treatment_id: string | null;
  appointment_id: string | null;
  stage: AssessmentStage;
  category: AssessmentCategory;
  recorded_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  age_years: number | null;
  sex: "F" | "M" | null;
  body_fat_pct: number | null;
  muscle_mass_pct: number | null;
  blood_pressure: string | null;
  details: Record<string, string>;
  notes: string | null;
  photo_front: string | null;
  photo_side: string | null;
  photo_back: string | null;
  report_client: string | null;
  report_staff: string | null;
  report_at: string | null;
} & Record<MeasureField, number | null>;

// Las fotos se comprimen en el navegador antes de enviarse; el tope evita
// que una imagen sin procesar bloquee la petición.
const photo = z.string().startsWith("data:image/").max(3_000_000).nullable().optional();
const measure = z.number().min(0).max(999).nullable().optional();

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  treatment_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  stage: z.enum(["inicial", "final"]),
  category: z.enum(["corporal", "laser", "facial", "postquirurgico"]),
  weight_kg: z.number().min(0).max(500).nullable().optional(),
  height_cm: z.number().min(0).max(260).nullable().optional(),
  age_years: z.number().int().min(0).max(120).nullable().optional(),
  sex: z.enum(["F", "M"]).nullable().optional(),
  body_fat_pct: z.number().min(0).max(100).nullable().optional(),
  muscle_mass_pct: z.number().min(0).max(100).nullable().optional(),
  blood_pressure: z.string().trim().max(20).nullable().optional(),
  ...Object.fromEntries(MEASURE_FIELDS.map((f) => [f, measure])),
  details: z.record(z.string(), z.string().max(400)).default({}),
  notes: z.string().trim().max(2000).nullable().optional(),
  photo_front: photo,
  photo_side: photo,
  photo_back: photo,
});

/** Fichas de valoración de un tratamiento (inicial y final). */
export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        treatment_id: z.string().uuid().nullable().optional(),
        client_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<Assessment[]> => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    let query = context.supabase
      .from("assessments")
      .select("*")
      .eq("business_id", businessId)
      .order("recorded_at", { ascending: true });

    if (data.treatment_id) query = query.eq("treatment_id", data.treatment_id);
    else if (data.client_id) query = query.eq("client_id", data.client_id);
    else return [];

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as Assessment[];
  });

/** Crea o actualiza la ficha. Hay una sola inicial y una sola final por tratamiento. */
export const saveAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { id, ...values } = data;

    if (id) {
      const { error } = await context.supabase
        .from("assessments")
        .update(values)
        .eq("id", id)
        .eq("business_id", businessId);
      if (error) throw new Error(error.message);
      return { id, created: false };
    }

    // Si ya existe la ficha de esa etapa para el tratamiento, se actualiza en vez de duplicar.
    if (values.treatment_id) {
      const { data: existing } = await context.supabase
        .from("assessments")
        .select("id")
        .eq("business_id", businessId)
        .eq("treatment_id", values.treatment_id)
        .eq("stage", values.stage)
        .maybeSingle();
      if (existing) {
        const { error } = await context.supabase
          .from("assessments")
          .update(values)
          .eq("id", existing.id)
          .eq("business_id", businessId);
        if (error) throw new Error(error.message);
        return { id: existing.id, created: false };
      }
    }

    const { data: row, error } = await context.supabase
      .from("assessments")
      .insert({ ...values, business_id: businessId, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, created: true };
  });

/** Guarda el informe de cierre (versión cliente y versión esteticista). */
export const saveAssessmentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        report_client: z.string().max(8000).nullable().optional(),
        report_staff: z.string().max(8000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("assessments")
      .update({
        report_client: data.report_client ?? null,
        report_staff: data.report_staff ?? null,
        report_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ClientAssessmentGroup = {
  treatment_id: string | null;
  service_name: string;
  sessions_total: number | null;
  inicial: Assessment | null;
  final: Assessment | null;
};

/** Valoraciones de un cliente agrupadas por tratamiento, para la ficha del cliente. */
export const listClientAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ client_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<ClientAssessmentGroup[]> => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("assessments")
      .select("*, treatment:treatments(id, sessions_total, service:services(name))")
      .eq("business_id", businessId)
      .eq("client_id", data.client_id)
      .order("recorded_at", { ascending: false });
    if (error) throw new Error(error.message);

    const groups = new Map<string, ClientAssessmentGroup>();
    for (const row of (rows ?? []) as any[]) {
      const key = row.treatment_id ?? `suelta-${row.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          treatment_id: row.treatment_id ?? null,
          service_name: row.treatment?.service?.name ?? "Sin servicio",
          sessions_total: row.treatment?.sessions_total ?? null,
          inicial: null,
          final: null,
        });
      }
      const g = groups.get(key)!;
      if (row.stage === "inicial") g.inicial = row as Assessment;
      else g.final = row as Assessment;
    }
    return [...groups.values()];
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("assessments")
      .delete()
      .eq("id", data.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
