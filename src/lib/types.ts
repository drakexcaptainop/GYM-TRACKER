// Formas de las respuestas de la API que usa el cliente.

export type Measure = "reps" | "reps_side" | "seconds" | "seconds_side" | "minutes" | "none";
export type Role = "main" | "accessory";
export type DayStatus = "completed" | "pending" | "rest";

export interface Profile {
  id: number;
  name: string;
}

export interface Guide {
  muscles: string;
  materials: string;
  steps: string[];
  tips: string;
  mistakes: string;
}

export interface WeekDay {
  date: string;
  weekday: number;
  status: DayStatus | null;
  kind: "session" | "rest";
}

export interface Home {
  profile: Profile;
  date: string;
  today: { kind: "session" | "rest"; title: string; exerciseCount: number; state: DayStatus };
  openSession: { id: string; status: "in_progress" | "paused" } | null;
  week: WeekDay[];
  streak: number;
  sessionsThisWeek: number;
  routine: { id: number; name: string; reducedVolumeUntil: string | null } | null;
}

export interface SessionExercise {
  id: number;
  position: number;
  kind: "warmup" | "exercise";
  exerciseId: number | null;
  name: string;
  detail: string;
  measure: Measure;
  role: Role;
  setsPlanned: number | null;
  targetMin: number | null;
  targetMax: number | null;
  weightPlanned: number | null;
  restSeconds: number | null;
  done: boolean;
  sets: { kind: "work" | "light"; setNumber: number; value: number | null; weightKg: number | null }[];
}

export interface Session {
  id: string;
  status: "in_progress" | "paused" | "completed";
  localDate: string;
  routineName: string;
  dayTitle: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
  position: string | null;
  exercises: SessionExercise[];
  guides: Record<number, Guide>;
}

export interface SessionSummary {
  exercisesCompleted: number;
  exercisesPlanned: number;
  setsDone: number;
  totalReps: number;
  durationSeconds: number | null;
}

export interface RoutineItem {
  id: number;
  exerciseId: number;
  name: string;
  measure: Measure;
  position: number;
  sets: number | null;
  targetMin: number | null;
  targetMax: number | null;
  weightKg: number | null;
  restSeconds: number | null;
  role: Role;
}

export interface RoutineDay {
  id: number;
  weekday: number;
  kind: "session" | "rest";
  title: string;
  warmupEnabled: boolean;
  exercises: RoutineItem[];
}

export interface Routine {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  reducedVolumeUntil: string | null;
  warmup: { id: number; name: string; detail: string }[];
  days: RoutineDay[];
  guides: Record<number, Guide>;
}

export interface RoutineListItem {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  reducedVolumeUntil: string | null;
}

export interface CatalogExercise {
  id: number;
  name: string;
  measure: Measure;
  role: Role;
  own: boolean;
}

export interface Progress {
  completedSessions: number;
  sessionsPerWeek: { weekStart: string; sessions: number }[];
  compliance: number | null;
  from: string;
  to: string;
}

export interface HistoryEntry {
  id: string;
  localDate: string;
  routineName: string;
  dayTitle: string;
  durationSeconds: number | null;
  exercisesCompleted: number;
  setsDone: number;
}

export interface EvolutionPoint {
  date: string;
  name: string;
  bestWeightKg: number | null;
  bestValue: number | null;
  totalValue: number | null;
  sets: number;
}

export interface UsPerson {
  id: number;
  name: string;
  isMe: boolean;
  streak: number;
  sessionsThisWeek: number;
  today: DayStatus;
  calendar: { date: string; status: DayStatus | null }[];
}

export interface Us {
  today: string;
  people: UsPerson[];
  phrases: { key: string; text: string }[];
  messages: { id: number; fromId: number; fromName: string; key: string; text: string; createdAt: number }[];
}
