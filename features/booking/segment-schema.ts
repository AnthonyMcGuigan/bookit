import { z } from "zod";
import { FINISH_PLANS, MATCH_TYPES, SEGMENT_KINDS, STIPULATIONS } from "@/lib/domain/enums";

export const segmentPayloadSchema = z
  .object({
    kind: z.enum(SEGMENT_KINDS),
    title: z.string().trim().max(120).default(""),
    custom_kind_label: z.string().trim().max(40).default(""),
    description: z.string().max(2000).default(""),
    duration_min: z.number().int().min(1, "At least 1 minute").max(120, "At most 120 minutes"),
    storyline_id: z.uuid().nullable().default(null),
    match_type: z.enum(MATCH_TYPES).nullable().default(null),
    stipulation: z.enum(STIPULATIONS).nullable().default(null),
    championship_id: z.uuid().nullable().default(null),
    stakes: z.string().trim().max(200).default(""),
    finish_plan: z.enum(FINISH_PLANS).nullable().default(null),
    predetermined_winner_side: z.number().int().min(0).max(40).nullable().default(null),
    title_changes_on_dq: z.boolean().default(false),
    interference: z.array(z.object({ wrestlerId: z.uuid(), favorsSide: z.number().int().min(0).max(40) })).max(6).default([]),
    sides: z
      .array(
        z.object({
          team_id: z.uuid().nullable().default(null),
          members: z.array(z.object({ wrestler_id: z.uuid(), role: z.enum(["competitor", "manager", "participant"]) })).max(30),
        }),
      )
      .max(40),
  })
  .superRefine((v, ctx) => {
    const ids = v.sides.flatMap((s) => s.members.map((m) => m.wrestler_id));
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["sides"], message: "Each wrestler can only appear once in a segment." });
    if (v.kind === "match" && !v.match_type) ctx.addIssue({ code: "custom", path: ["match_type"], message: "Choose a match type." });
    if (v.predetermined_winner_side !== null && v.predetermined_winner_side >= v.sides.length) {
      ctx.addIssue({ code: "custom", path: ["predetermined_winner_side"], message: "The planned winner side doesn't exist." });
    }
  });

export type SegmentPayload = z.infer<typeof segmentPayloadSchema>;
