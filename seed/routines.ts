import type { Role } from "../shared/schemas.ts";

export interface SeedPrescription {
  slug: string;
  sets: number | null;
  min: number | null;
  max: number | null;
  role: Role;
  /** null = sin descanso entre series */
  rest: number | null;
}

export interface SeedDay {
  weekday: number;
  kind: "session" | "rest";
  title: string;
  warmup: boolean;
  exercises: SeedPrescription[];
}

export interface SeedWarmupItem {
  name: string;
  detail: string;
}

export interface SeedRoutine {
  id: number;
  profileId: 1 | 2;
  name: string;
  description: string;
  /** dias de volumen reducido al inicio, solo como indicacion */
  reducedVolumeDays: number | null;
  warmup: SeedWarmupItem[];
  days: SeedDay[];
}

// Descansos iniciales por persona: [principal, accesorio] en segundos.
const REST_P1: Record<Role, number> = { main: 120, accessory: 60 };
const REST_P2: Record<Role, number> = { main: 75, accessory: 50 };

function maker(rest: Record<Role, number>) {
  return (slug: string, sets: number | null, min: number | null, max: number | null, role: Role, noRest = false): SeedPrescription => ({
    slug,
    sets,
    min,
    max,
    role,
    rest: noRest ? null : rest[role],
  });
}

const p1 = maker(REST_P1);
const p2 = maker(REST_P2);

const restDay = (weekday: number): SeedDay => ({ weekday, kind: "rest", title: "Descanso", warmup: false, exercises: [] });

export const routines: SeedRoutine[] = [
  {
    id: 1,
    profileId: 1,
    name: "Rutina inicial",
    description: "Glúteos y piernas dos veces por semana, brazos y abdomen, y un día de recuperación activa.",
    reducedVolumeDays: 14,
    warmup: [
      { name: "Sentadillas sin peso", detail: "15 repeticiones. Pies al ancho de los hombros, baja con la espalda recta y sube con control." },
      { name: "Rotaciones de cadera", detail: "10 por lado. Apoyado en una pared, haz círculos amplios con la rodilla levantada." },
      { name: "Movilidad de tobillos", detail: "15 por lado. Levanta un pie y dibuja círculos con la punta del pie en los dos sentidos." },
      { name: "Flexión controlada de rodillas", detail: "10 por pierna. Dobla la rodilla despacio hasta donde la sientas cómoda y vuelve a estirar." },
      { name: "Balanceo de piernas", detail: "10 por pierna. Apoyado en una pared, balancea la pierna hacia adelante y atrás con control." },
      { name: "Rotaciones internas y externas de cadera", detail: "10 por pierna. Con la rodilla doblada, gira el muslo hacia adentro y hacia afuera." },
    ],
    days: [
      {
        weekday: 1,
        kind: "session",
        title: "Glúteos y piernas (glúteos y cuádriceps)",
        warmup: true,
        exercises: [
          p1("sentadilla-profunda-mochila", 3, 12, 15, "main"),
          p1("hip-thrust-mochila", 4, 12, 15, "main"),
          p1("sentadilla-bulgara", 3, 10, 12, "main"),
          p1("elevacion-talones", 3, 15, 20, "accessory"),
          p1("abduccion-cadera-lateral", 2, 15, 15, "accessory"),
        ],
      },
      {
        weekday: 2,
        kind: "session",
        title: "Brazos y abdomen",
        warmup: true,
        exercises: [
          p1("flexiones", 3, 8, 12, "main"),
          p1("remo-mochila", 3, 12, 15, "main"),
          p1("curl-biceps", 3, 12, 15, "accessory"),
          p1("extension-triceps-cabeza", 3, 12, 15, "accessory"),
          p1("elevacion-piernas", 3, 10, 15, "accessory"),
          p1("plancha-antebrazos", 3, 25, 40, "accessory"),
          p1("dead-bug", 2, 10, 10, "accessory"),
        ],
      },
      {
        weekday: 3,
        kind: "session",
        title: "Recuperación activa",
        warmup: false,
        exercises: [
          p1("caminata", null, 20, 30, "accessory", true),
          p1("movilidad-cadera", 2, 10, 10, "accessory", true),
          p1("rotaciones-hombros", 2, 15, 15, "accessory", true),
          p1("estiramientos-piernas", 2, 20, 20, "accessory", true),
          p1("movilidad-espalda", 2, 10, 10, "accessory", true),
        ],
      },
      {
        weekday: 4,
        kind: "session",
        title: "Glúteos y piernas (cadena posterior)",
        warmup: true,
        exercises: [
          p1("peso-muerto-rumano", 3, 12, 12, "main"),
          p1("puente-gluteo-una-pierna", 3, 10, 12, "main"),
          p1("zancadas-atras", 3, 12, 12, "main"),
          p1("patada-gluteo-cuadrupedia", 3, 15, 15, "accessory"),
          p1("curl-femoral-deslizante", 2, 10, 12, "accessory"),
        ],
      },
      {
        weekday: 5,
        kind: "session",
        title: "Tren superior y abdomen",
        warmup: true,
        exercises: [
          p1("press-hombros", 3, 10, 12, "main"),
          p1("elevaciones-laterales", 3, 12, 15, "accessory"),
          p1("remo-mochila", 3, 12, 15, "main"),
          p1("curl-biceps", 2, 12, 15, "accessory"),
          p1("extension-triceps-cabeza", 2, 12, 15, "accessory"),
          p1("plancha-lateral", 3, 20, 30, "accessory"),
          p1("crunch-abdominal", 2, 15, 15, "accessory"),
        ],
      },
      restDay(6),
      restDay(7),
    ],
  },
  {
    id: 2,
    profileId: 2,
    name: "Rutina inicial",
    description: "Rutina ligera con énfasis en brazos, hombros y abdomen, pensada para avanzar de forma gradual.",
    reducedVolumeDays: null,
    warmup: [],
    days: [
      {
        weekday: 1,
        kind: "session",
        title: "Brazos y abdomen",
        warmup: false,
        exercises: [
          p2("curl-biceps", 3, 12, 12, "main"),
          p2("extension-triceps-cabeza", 3, 12, 12, "main"),
          p2("flexiones-rodillas", 2, 8, 10, "main"),
          p2("crunch-abdominal", 3, 15, 15, "accessory"),
          p2("plancha-antebrazos", 3, 20, 30, "accessory"),
        ],
      },
      {
        weekday: 2,
        kind: "session",
        title: "Actividad ligera y abdomen",
        warmup: false,
        exercises: [
          p2("caminata", null, 20, 20, "accessory", true),
          p2("dead-bug", 2, 10, 10, "accessory"),
          p2("elevacion-rodillas", 2, 12, 12, "accessory"),
          p2("movilidad-hombros-brazos", 2, 15, 15, "accessory", true),
          p2("estiramientos-suaves", null, null, null, "accessory", true),
        ],
      },
      {
        weekday: 3,
        kind: "session",
        title: "Recuperación activa",
        warmup: false,
        exercises: [
          p2("caminata", null, 15, 20, "accessory", true),
          p2("movilidad-general", null, null, null, "accessory", true),
          p2("estiramientos-suaves", null, null, null, "accessory", true),
        ],
      },
      {
        weekday: 4,
        kind: "session",
        title: "Brazos, hombros y abdomen",
        warmup: false,
        exercises: [
          p2("curl-biceps", 3, 12, 12, "main"),
          p2("elevaciones-laterales", 2, 12, 12, "accessory"),
          p2("extension-triceps-cabeza", 3, 12, 12, "main"),
          p2("remo-mochila", 2, 12, 12, "main"),
          p2("plancha-lateral", 2, 20, 20, "accessory"),
          p2("bicicleta-abdominal", 2, 12, 12, "accessory"),
        ],
      },
      {
        weekday: 5,
        kind: "session",
        title: "Circuito ligero de cuerpo completo y abdomen",
        warmup: false,
        exercises: [
          p2("sentadillas-sin-peso", 2, 15, 15, "main"),
          p2("flexiones-rodillas", 2, 8, 8, "main"),
          p2("curl-biceps", 2, 12, 12, "accessory"),
          p2("crunch-abdominal", 2, 15, 15, "accessory"),
          p2("dead-bug", 2, 10, 10, "accessory"),
          p2("plancha-antebrazos", 2, 20, 30, "accessory"),
        ],
      },
      restDay(6),
      restDay(7),
    ],
  },
];
