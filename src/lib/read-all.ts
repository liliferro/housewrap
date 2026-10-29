import type { SupabaseClient } from "@supabase/supabase-js";
// Explicit pagination prevents weekly totals being silently truncated by the API row limit.
export async function readAll<T>(
  db: SupabaseClient,
  table: string,
  keys: string[],
  ascending = true,
): Promise<{ data: T[]; error: unknown | null }> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(table).select("*");
    for (const key of keys) query = query.order(key, { ascending });
    const result = await query.range(offset, offset + 999);
    if (result.error) return { data: [], error: result.error };
    for (const row of result.data as T[]) {
      const record = row as Record<string, unknown>;
      const id = String(
        record.id ??
          [record.user_id, record.project_id, record.effective_date].join("|"),
      );
      if (!seen.has(id)) {
        seen.add(id);
        rows.push(row);
      }
    }
    if (result.data.length < 1000) return { data: rows, error: null };
  }
}
