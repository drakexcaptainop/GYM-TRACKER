-- Gym Tracker: esquema inicial. Todas las fechas "local_date"/"date" son YYYY-MM-DD en America/La_Paz.
-- Los instantes (created_at, started_at, ...) son milisegundos desde epoch.

CREATE TABLE profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  pin_salt TEXT,
  pin_hash TEXT,
  pin_iterations INTEGER
);

CREATE TABLE login_lock (
  profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

-- Ejercicios base (owner_profile_id NULL, con slug estable) y ejercicios propios de un perfil.
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,
  owner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  measure TEXT NOT NULL DEFAULT 'reps'
    CHECK (measure IN ('reps', 'reps_side', 'seconds', 'seconds_side', 'minutes', 'none')),
  role TEXT NOT NULL DEFAULT 'accessory' CHECK (role IN ('main', 'accessory')),
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_exercises_owner ON exercises(owner_profile_id);

-- Guia base (profile_id NULL) o copia propia de un perfil. steps es un arreglo JSON de textos.
CREATE TABLE guides (
  id INTEGER PRIMARY KEY,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  muscles TEXT NOT NULL DEFAULT '',
  materials TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  tips TEXT NOT NULL DEFAULT '',
  mistakes TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX uq_guides_base ON guides(exercise_id) WHERE profile_id IS NULL;
CREATE UNIQUE INDEX uq_guides_copy ON guides(exercise_id, profile_id) WHERE profile_id IS NOT NULL;

CREATE TABLE routines (
  id INTEGER PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  reduced_volume_until TEXT,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_routines_profile ON routines(profile_id);
CREATE UNIQUE INDEX uq_routines_one_active ON routines(profile_id) WHERE is_active = 1;

-- weekday: 1 = lunes ... 7 = domingo.
CREATE TABLE routine_days (
  id INTEGER PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  kind TEXT NOT NULL DEFAULT 'rest' CHECK (kind IN ('session', 'rest')),
  title TEXT NOT NULL DEFAULT '',
  warmup_enabled INTEGER NOT NULL DEFAULT 0 CHECK (warmup_enabled IN (0, 1)),
  UNIQUE (routine_id, weekday)
);

CREATE TABLE routine_warmup_items (
  id INTEGER PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_warmup_routine ON routine_warmup_items(routine_id, position);

CREATE TABLE routine_day_exercises (
  id INTEGER PRIMARY KEY,
  routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  sets INTEGER,
  target_min INTEGER,
  target_max INTEGER,
  weight_kg REAL,
  rest_seconds INTEGER,
  role TEXT NOT NULL DEFAULT 'accessory' CHECK (role IN ('main', 'accessory'))
);
CREATE INDEX idx_rde_day ON routine_day_exercises(routine_day_id, position);
CREATE INDEX idx_rde_exercise ON routine_day_exercises(exercise_id);

-- Una sesion es una copia de lo planeado: no tiene claves foraneas a la rutina ni a los ejercicios.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  routine_name TEXT NOT NULL,
  day_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed')),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  position TEXT
);
CREATE INDEX idx_sessions_profile_date ON sessions(profile_id, local_date);
CREATE INDEX idx_sessions_profile_status ON sessions(profile_id, status);

CREATE TABLE session_exercises (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'exercise' CHECK (kind IN ('warmup', 'exercise')),
  exercise_id INTEGER,
  name TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  measure TEXT NOT NULL DEFAULT 'reps',
  role TEXT NOT NULL DEFAULT 'accessory',
  sets_planned INTEGER,
  target_min INTEGER,
  target_max INTEGER,
  weight_planned REAL,
  rest_seconds INTEGER,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  UNIQUE (session_id, position)
);
CREATE INDEX idx_se_exercise ON session_exercises(exercise_id);

CREATE TABLE session_sets (
  id INTEGER PRIMARY KEY,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'work' CHECK (kind IN ('work', 'light')),
  set_number INTEGER NOT NULL,
  value INTEGER,
  weight_kg REAL,
  completed_at INTEGER NOT NULL,
  UNIQUE (session_exercise_id, kind, set_number)
);

CREATE TABLE day_log (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'rest')),
  session_id TEXT,
  PRIMARY KEY (profile_id, date)
) WITHOUT ROWID;

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  from_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phrase_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_to ON messages(to_profile_id, created_at);
