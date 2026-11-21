import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ClipboardList, Dumbbell, HeartHandshake, House, TrendingUp } from "lucide-react";
import { ApiError, api, onUnauthorized } from "../lib/api.ts";
import { queryClient } from "../lib/query.ts";
import type { Profile } from "../lib/types.ts";
import { Login } from "../features/auth/Login.tsx";
import { HomeScreen } from "../features/home/HomeScreen.tsx";
import { ProgressScreen } from "../features/progress/ProgressScreen.tsx";
import { SessionDetailScreen } from "../features/progress/SessionDetailScreen.tsx";
import { ExerciseEvolutionScreen } from "../features/progress/ExerciseEvolutionScreen.tsx";
import { RoutineEditor } from "../features/routines/RoutineEditor.tsx";
import { RoutinesScreen } from "../features/routines/RoutinesScreen.tsx";
import { TrainScreen } from "../features/train/TrainScreen.tsx";
import { UsScreen } from "../features/us/UsScreen.tsx";
import { Loading } from "../ui/Screen.tsx";

const NAV = [
  { to: "/", label: "Inicio", icon: House, end: true },
  { to: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { to: "/nosotros", label: "Nosotros", icon: HeartHandshake },
  { to: "/progreso", label: "Mi progreso", icon: TrendingUp },
  { to: "/rutinas", label: "Mis rutinas", icon: ClipboardList },
];

function BottomNav() {
  return (
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur safe-bottom">
      <ul className="mx-auto flex max-w-2xl">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition ${isActive ? "text-cyan" : "text-muted"}`
              }
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Shell() {
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ profile: Profile }>("/api/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(
    () =>
      onUnauthorized(() => {
        client.clear();
        client.setQueryData(["me"], null);
      }),
    [client],
  );

  if (me.isPending) return <Loading />;
  const unauthorized = me.isError && me.error instanceof ApiError && me.error.status === 401;
  if (unauthorized || me.data === null || !me.data) {
    if (me.isError && !unauthorized) return <Loading label="Sin conexión. Reintentando…" />;
    return <Login />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/entrenar" element={<TrainScreen />} />
        <Route path="/nosotros" element={<UsScreen />} />
        <Route path="/progreso" element={<ProgressScreen />} />
        <Route path="/progreso/sesion/:id" element={<SessionDetailScreen />} />
        <Route path="/progreso/ejercicio/:id" element={<ExerciseEvolutionScreen />} />
        <Route path="/rutinas" element={<RoutinesScreen profile={me.data.profile} />} />
        <Route path="/rutinas/:id" element={<RoutineEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
