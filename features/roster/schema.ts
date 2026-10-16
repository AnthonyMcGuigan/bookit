import { z } from "zod";
import { ALIGNMENTS, CARD_POSITIONS, CAREER_STATUSES, DIVISIONS, GENDERS, WRESTLER_ROLES } from "@/lib/domain/enums";
import { ATTRIBUTE_KEYS } from "@/lib/domain/entities";

const score = z.coerce.number().int("Whole numbers only").min(0, "0–100").max(100, "0–100");
const optionalInt = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v.trim() === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Enter ${min}–${max}` });
        return z.NEVER;
      }
      return n;
    });

const attributeShape = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, score])) as Record<(typeof ATTRIBUTE_KEYS)[number], typeof score>;

export const wrestlerFormSchema = z.object({
  ring_name: z.string().trim().min(1, "Ring name is required").max(60),
  alternate_name: z.string().trim().max(60).default(""),
  real_name: z.string().trim().max(80).default(""),
  gender: z.enum(GENDERS),
  division: z.enum(DIVISIONS),
  billed_from: z.string().trim().max(80).default(""),
  height_cm: optionalInt(120, 250),
  weight_kg: optionalInt(40, 250),
  birth_date: z.iso.date().optional().transform((v) => v ?? null),
  debut_date: z.iso.date().optional().transform((v) => v ?? null),
  biography: z.string().max(4000).default(""),
  finisher: z.string().trim().max(60).default(""),
  career_status: z.enum(CAREER_STATUSES),
  alignment: z.enum(ALIGNMENTS),
  role: z.enum(WRESTLER_ROLES),
  card_position: z.enum(CARD_POSITIONS),
  ...attributeShape,
  popularity: score,
  reputation: score,
  morale: score,
  momentum: z.coerce.number().int().min(-100, "−100 to 100").max(100, "−100 to 100"),
});
export type WrestlerForm = z.infer<typeof wrestlerFormSchema>;

export const contractFormSchema = z.object({
  promotion_id: z.uuid("Choose a promotion"),
  months: z.coerce.number().int().min(1, "1–60 months").max(60, "1–60 months"),
  weekly_salary: z.coerce.number().int().min(0).max(1_000_000),
  appearance_fee: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
