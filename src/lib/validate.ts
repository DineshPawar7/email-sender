import type { MemberRow } from "./queue";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RowError = { row: number; reason: string };

/**
 * Raw Excel rows ko validate karta hai.
 * - email format check
 * - file ke andar duplicate email check
 * Return: valid rows + errors (row number Excel ke hisaab se, header = row 1)
 */
export function validateRows(raw: Record<string, unknown>[]) {
  const valid: MemberRow[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  raw.forEach((r, i) => {
    const rowNo = i + 2;
    const name = String(r.name ?? r.Name ?? "").trim();
    const email = String(r.email ?? r.Email ?? "").trim().toLowerCase();
    const phone = String(r.phone ?? r.Phone ?? "").trim();

    if (!name) return errors.push({ row: rowNo, reason: "Name missing" });
    if (!EMAIL_RE.test(email)) return errors.push({ row: rowNo, reason: `Invalid email: ${email || "empty"}` });
    if (seen.has(email)) return errors.push({ row: rowNo, reason: `Duplicate in file: ${email}` });

    seen.add(email);
    valid.push({ name, email, phone: phone || undefined });
  });

  return { valid, errors };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
