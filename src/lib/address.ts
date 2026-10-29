import { z } from "zod";
export const addressChoiceSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(5).max(200),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type AddressChoice = z.infer<typeof addressChoiceSchema>;
export function parseProjectAddress(form: FormData): {
  address_source: "manual" | "photon";
  address_ref: string | null;
  latitude: number | null;
  longitude: number | null;
  address_review_note: string | null;
} {
  if (form.get("address_manual") === "on") {
    const note = String(form.get("address_review_note") || "").trim();
    if (note.length < 10 || note.length > 500)
      throw new Error(
        "Explica por qué esta dirección queda pendiente de verificar (mínimo 10 caracteres).",
      );
    return {
      address_source: "manual" as const,
      address_ref: null,
      latitude: null,
      longitude: null,
      address_review_note: note,
    };
  }
  let choice: AddressChoice;
  try {
    choice = addressChoiceSchema.parse(
      JSON.parse(String(form.get("address_choice") || "")),
    );
  } catch {
    throw new Error("Selecciona una dirección de las sugerencias del mapa.");
  }
  if (choice.label !== String(form.get("address")))
    throw new Error(
      "La dirección cambió. Selecciona una coincidencia del mapa nuevamente.",
    );
  return {
    address_source: "photon" as const,
    address_ref: choice.id,
    latitude: choice.lat,
    longitude: choice.lon,
    address_review_note: null,
  };
}
export function photonAddresses(raw: unknown): AddressChoice[] {
  const schema = z.object({
    features: z.array(
      z.object({
        properties: z.object({
          osm_type: z.string(),
          osm_id: z.number(),
          housenumber: z.string().optional(),
          street: z.string().optional(),
          city: z.string().optional(),
          locality: z.string().optional(),
          district: z.string().optional(),
          state: z.string().optional(),
          postcode: z.string().optional(),
          country: z.string().optional(),
          countrycode: z.string().optional(),
        }),
        geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      }),
    ),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return [];
  const found: AddressChoice[] = [];
  for (const { properties: p, geometry: g } of parsed.data.features) {
    if (
      p.countrycode?.toUpperCase() !== "US" ||
      !p.street ||
      !p.housenumber ||
      !(p.city || p.locality || p.district)
    )
      continue;
    const label = [
      `${p.housenumber} ${p.street}`,
      p.city || p.locality || p.district,
      [p.state, p.postcode].filter(Boolean).join(" "),
      "USA",
    ]
      .filter(Boolean)
      .join(", ");
    const item = addressChoiceSchema.safeParse({
      id: `${p.osm_type}${p.osm_id}`,
      label,
      lat: g.coordinates[1],
      lon: g.coordinates[0],
    });
    if (item.success && !found.some((x) => x.label === label))
      found.push(item.data);
  }
  return found.slice(0, 5);
}
