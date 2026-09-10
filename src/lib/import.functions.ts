import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireBusinessId } from "./tenant";
import { mapClients, mapProfessionals, mapServices } from "./import-map";

const payload = z.object({
  entity: z.enum(["clients", "services", "professionals"]),
  rows: z.array(z.record(z.string(), z.unknown())).max(5000),
});

export const importData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => payload.parse(i))
  .handler(async ({ data, context }) => {
    const businessId = await requireBusinessId(context.supabase, context.userId);

    const mapped =
      data.entity === "clients"
        ? mapClients(data.rows, businessId)
        : data.entity === "services"
          ? mapServices(data.rows, businessId)
          : mapProfessionals(data.rows, businessId);

    if (!mapped.length) throw new Error("No se encontraron filas válidas en el archivo");

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += 200) {
      const chunk = mapped.slice(i, i + 200);
      const table = context.supabase.from(data.entity) as unknown as {
        insert: (v: unknown) => Promise<{ error: { message: string } | null }>;
      };
      const { error } = await table.insert(chunk);
      if (error) throw new Error(error.message);
      inserted += chunk.length;
    }


    return { inserted, skipped: data.rows.length - mapped.length };
  });
