import type { Attachment } from "./progress-media";
import { z } from "zod";
import type { ProjectDetails } from "./project-details";
export type Project = Partial<ProjectDetails> & {
  pipeline_stage?: import("./pipeline").PipelineStage;
  pipeline_changed_at?: string | null;
  id: string;
  name: string;
  builder: string;
  builder_id?: string | null;
  contact_id?: string | null;
  progress?: number;
  progress_notes?: string;
  started_at?: string | null;
  finished_at?: string | null;
  quoted_estimate_id?: string | null;
  address: string;
  address_source?: "photon" | "manual" | null;
  address_ref?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address_review_note?: string | null;
  status: "scheduled" | "active" | "done";
  target_date: string | null;
  created_at: string;
};
export type Estimate = {
  id: string;
  project_id: string;
  area: number;
  rate: number;
  waste: number;
  roll_size: number;
  rolls: number;
  total: number;
  status: "draft" | "approved";
  created_at: string;
};
export type Report = {
  work_date?: string;
  review_status?: "pending" | "approved" | "observed";
  review_note?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  attachments?: Attachment[];
  id: string;
  project_id: string;
  author_id?: string;
  author_name?: string | null;
  notes: string;
  hours: number;
  rolls: number;
  created_at: string;
};
export type Data = {
  workers?: import("./workers").Worker[];
  worker_rates?: import("./workers").WorkerRate[];
  assignments?: import("./workers").Assignment[];
  builders: Builder[];
  contacts: Contact[];
  projects: Project[];
  estimates: Estimate[];
  reports: Report[];
};
export type Builder = { id: string; name: string };
export type Contact = {
  id: string;
  builder_id: string;
  name: string;
  email: string | null;
  phone: string | null;
};
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .or(z.literal(""))
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .or(z.literal(""))
    .transform((v) => v || null),
});
// Upgrade saved demonstrations without discarding the user's existing works.
export function withDirectory(data: Data): Data {
  const builders = [...(data.builders || [])];
  const projects = data.projects.map((p) => {
    let builder = builders.find(
      (b) =>
        b.id === p.builder_id ||
        b.name.trim().toLowerCase() === p.builder.trim().toLowerCase(),
    );
    if (!builder) {
      builder = { id: crypto.randomUUID(), name: p.builder };
      builders.push(builder);
    }
    return { ...p, builder_id: builder.id };
  });
  return { ...data, projects, builders, contacts: data.contacts || [] };
}
export const estimateSchema = z.object({
  area: z.coerce.number().positive().max(1000000),
  rate: z.coerce.number().positive().max(10000),
  waste: z.coerce.number().min(0).max(50),
  roll_size: z.coerce.number().positive().max(100000),
});
export function calculate(input: unknown) {
  const p = estimateSchema.parse(input);
  return {
    ...p,
    rolls: Math.ceil((p.area * (1 + p.waste / 100)) / p.roll_size),
    total: Math.round(p.area * Math.round(p.rate * 100)) / 100,
  };
}
export const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  builder: z.string().trim().min(2).max(100),
  address: z.string().trim().min(3).max(200),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
});
export const reportSchema = z.object({
  author_name: z.string().trim().min(2).max(100).optional(),
  project_id: z.string().uuid(),
  notes: z.string().trim().max(2000),
  hours: z.coerce.number().min(0).max(24),
  rolls: z.coerce.number().min(0).max(100),
});
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export const num = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
export function demoData(): Data {
  const now = new Date().toISOString();
  return {
    builders: [],
    contacts: [],
    projects: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Oakview · Lot 14",
        builder: "Oakview Builders",
        address: "Marietta, GA",
        status: "active",
        target_date: null,
        created_at: now,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "The Ridge · Lot 08",
        builder: "Ridge Homes",
        address: "Alpharetta, GA",
        status: "scheduled",
        target_date: null,
        created_at: now,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Westfield · Lot 21",
        builder: "Westfield Construction",
        address: "Atlanta, GA",
        status: "active",
        target_date: null,
        created_at: now,
      },
    ],
    estimates: [],
    reports: [],
  };
}
