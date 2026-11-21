import { z } from "zod";

export const MEASURES = ["reps", "reps_side", "seconds", "seconds_side", "minutes", "none"] as const;
export const measureSchema = z.enum(MEASURES);
export type Measure = z.infer<typeof measureSchema>;

export const roleSchema = z.enum(["main", "accessory"]);
export type Role = z.infer<typeof roleSchema>;

export const dayStatusSchema = z.enum(["completed", "pending", "rest"]);
export type DayStatus = z.infer<typeof dayStatusSchema>;

/** 1 = lunes ... 7 = domingo */
export const weekdaySchema = z.number().int().min(1).max(7);

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---------- Ejercicios y guias ----------

export const guideSchema = z.object({
  muscles: z.string().max(200).default(""),
  materials: z.string().max(200).default(""),
  steps: z.array(z.string().min(1).max(500)).max(20).default([]),
  tips: z.string().max(1000).default(""),
  mistakes: z.string().max(1000).default(""),
});
export type GuideInput = z.infer<typeof guideSchema>;

export const exerciseCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  measure: measureSchema.default("reps"),
  role: roleSchema.default("accessory"),
  guide: guideSchema.optional(),
});

export const exercisePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  measure: measureSchema.optional(),
  role: roleSchema.optional(),
});

// ---------- Rutinas ----------

const optionalInt = (max: number) => z.number().int().min(0).max(max).nullable().optional();

export const routineCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(""),
});

export const routinePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
});

export const duplicateSchema = z.object({ name: z.string().trim().min(1).max(80).optional() });

export const dayPatchSchema = z.object({
  kind: z.enum(["session", "rest"]).optional(),
  title: z.string().trim().max(80).optional(),
  warmupEnabled: z.boolean().optional(),
});

const prescriptionFields = {
  sets: optionalInt(20),
  targetMin: optionalInt(9999),
  targetMax: optionalInt(9999),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  restSeconds: optionalInt(900),
  role: roleSchema.optional(),
};

const targetsOrdered = (v: { targetMin?: number | null; targetMax?: number | null }) =>
  v.targetMin == null || v.targetMax == null || v.targetMin <= v.targetMax;

export const dayExerciseCreateSchema = z
  .object({ exerciseId: z.number().int().positive(), ...prescriptionFields })
  .refine(targetsOrdered, { message: "targetMin must be <= targetMax" });

export const dayExercisePatchSchema = z.object(prescriptionFields).refine(targetsOrdered, {
  message: "targetMin must be <= targetMax",
});

export const orderSchema = z.object({ itemIds: z.array(z.number().int().positive()).max(60) });

export const warmupSchema = z.object({
  items: z
    .array(z.object({ name: z.string().trim().min(1).max(80), detail: z.string().max(300).default("") }))
    .max(20),
});
