import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;

/** Devuelve el negocio del usuario autenticado. Lanza si aún no tiene ninguno. */
export async function requireBusinessId(supabase: Db, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("SIN_NEGOCIO");
  return data.business_id;
}

export async function findBusinessId(supabase: Db, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.business_id ?? null;
}
