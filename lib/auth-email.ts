/** Converts a short username to email when no @ is present (Supabase Auth requires an email). */
export function toAuthEmail(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return t;
  if (t.includes("@")) return t;
  const domain =
    process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN?.trim() || "firma.local";
  return `${t}@${domain}`;
}
