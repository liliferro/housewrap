import { z } from "zod";
export type Project = {
  id: string;
  name: string;
  builder: string;
  address: string;
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
  id: string;
  project_id: string;
  author_id?: string;
  notes: string;
  hours: number;
  rolls: number;
  created_at: string;
};
export type Data = {
  projects: Project[];
  estimates: Estimate[];
  reports: Report[];
};
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
  project_id: z.string().uuid(),
  notes: z.string().trim().min(5).max(2000),
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
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
export function demoData(): Data {
  const now = new Date().toISOString();
  return {
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
