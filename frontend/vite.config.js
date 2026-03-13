import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/blindbench/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});
