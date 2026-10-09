import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Only split React-INDEPENDENT heavy libs. Splitting react/motion caused
          // motion to load before React (createContext undefined) in the built bundle.
          if (!id.includes("node_modules")) return;
          if (id.includes("echarts") || id.includes("zrender")) return "echarts";
          if (id.includes("maplibre")) return "maplibre";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
