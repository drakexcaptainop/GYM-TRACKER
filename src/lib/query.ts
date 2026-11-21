import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api.ts";

// Pocas requests: los datos se consideran frescos un rato y no se vuelven a pedir al cambiar de pestaña.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status > 0 && error.status < 500) && count < 1,
    },
  },
});
