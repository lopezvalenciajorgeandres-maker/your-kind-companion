export const COUNTRY_CODES = [
  { code: "+57", label: "Colombia (+57)" },
  { code: "+52", label: "México (+52)" },
  { code: "+1", label: "EE.UU. / Canadá (+1)" },
  { code: "+34", label: "España (+34)" },
  { code: "+51", label: "Perú (+51)" },
  { code: "+56", label: "Chile (+56)" },
  { code: "+54", label: "Argentina (+54)" },
  { code: "+593", label: "Ecuador (+593)" },
  { code: "+58", label: "Venezuela (+58)" },
  { code: "+507", label: "Panamá (+507)" },
  { code: "+506", label: "Costa Rica (+506)" },
  { code: "+502", label: "Guatemala (+502)" },
  { code: "+591", label: "Bolivia (+591)" },
  { code: "+598", label: "Uruguay (+598)" },
  { code: "+595", label: "Paraguay (+595)" },
  { code: "+1809", label: "Rep. Dominicana (+1809)" },
  { code: "+55", label: "Brasil (+55)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+39", label: "Italia (+39)" },
  { code: "+33", label: "Francia (+33)" },
];

export const DEFAULT_COUNTRY_CODE = "+57";

/** Divide un número guardado en (indicativo, número local). */
export function splitPhone(value?: string | null): { code: string; number: string } {
  const raw = (value ?? "").replace(/[^\d+]/g, "");
  if (!raw) return { code: DEFAULT_COUNTRY_CODE, number: "" };
  const normalized = raw.startsWith("+") ? raw : `+${raw}`;
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => normalized.startsWith(c.code));
  if (match) return { code: match.code, number: normalized.slice(match.code.length) };
  return { code: DEFAULT_COUNTRY_CODE, number: normalized.replace(/^\+/, "") };
}

export function joinPhone(code: string, number: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `${code}${digits}`;
}
