import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  business_name: z.string().trim().min(1).max(120),
  owner_name: z.string().trim().min(1).max(120),
  manager_name: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
  tiktok: z.string().trim().max(100).optional().nullable(),
  facebook: z.string().trim().max(100).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  booking_phone: z.string().trim().max(40).optional().nullable(),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_profiles")
      .upsert({ ...data, user_id: context.userId, onboarded: true }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
