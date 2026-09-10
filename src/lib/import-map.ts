type Row = Record<string, unknown>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

function pick(row: Row, keys: string[]): string {
  const entries = Object.entries(row).map(([k, v]) => [norm(k), v] as const);
  for (const key of keys) {
    const hit = entries.find(([k]) => k === norm(key));
    if (hit && String(hit[1] ?? "").trim() !== "") return String(hit[1]).trim();
  }
  return "";
}

const num = (v: string) => {
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function mapClients(rows: Row[], businessId: string) {
  return rows
    .map((r) => {
      const full_name = pick(r, ["full_name", "nombre", "cliente", "name", "nombres"]);
      if (!full_name) return null;
      return {
        business_id: businessId,
        full_name,
        last_name: pick(r, ["last_name", "apellido", "apellidos"]) || null,
        phone: pick(r, ["phone", "telefono", "celular", "movil"]) || null,
        whatsapp: pick(r, ["whatsapp", "wpp"]) || null,
        email: pick(r, ["email", "correo"]) || null,
        address: pick(r, ["address", "direccion"]) || null,
        source: pick(r, ["source", "origen"]) || null,
        notes: pick(r, ["notes", "notas", "observaciones"]) || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

export function mapServices(rows: Row[], businessId: string) {
  return rows
    .map((r) => {
      const name = pick(r, ["name", "nombre", "servicio"]);
      if (!name) return null;
      const price = num(pick(r, ["price", "precio", "valor", "price_cents"]));
      const dur = num(pick(r, ["duration_min", "duracion", "duracionmin", "minutos", "min"]));
      return {
        business_id: businessId,
        name,
        category: pick(r, ["category", "categoria"]) || null,
        description: pick(r, ["description", "descripcion"]) || null,
        duration_min: dur > 0 ? Math.round(dur) : 60,
        price_cents: Math.round(price * 100),
        active: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

export function mapProfessionals(rows: Row[], businessId: string) {
  return rows
    .map((r) => {
      const full_name = pick(r, ["full_name", "nombre", "profesional", "name"]);
      if (!full_name) return null;
      return {
        business_id: businessId,
        full_name,
        specialty: pick(r, ["specialty", "especialidad"]) || null,
        phone: pick(r, ["phone", "telefono", "celular"]) || null,
        email: pick(r, ["email", "correo"]) || null,
        active: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}
