export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { profileId: number };
};
