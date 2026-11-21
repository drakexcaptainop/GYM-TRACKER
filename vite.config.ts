import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    // Solo se guarda el cascarón de la app; los datos nunca se cachean aquí (siempre vienen de /api).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Gym Tracker",
        short_name: "Gym Tracker",
        description: "Entrena, registra y acompáñate.",
        lang: "es",
        display: "standalone",
        background_color: "#05060a",
        theme_color: "#05060a",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg}"], navigateFallbackDenylist: [new RegExp("^/api/")], runtimeCaching: [] },
    }),
  ],
});
