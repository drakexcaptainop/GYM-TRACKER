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
