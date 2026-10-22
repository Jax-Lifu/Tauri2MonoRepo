import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { version } from "./package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { target: ["chrome111", "safari16.4", "firefox128"] },
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(version) },
  server: { port: 5173, strictPort: true },
});
