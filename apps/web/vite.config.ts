import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { version } from "./package.json";
import { identifier } from "../desktop/src-tauri/tauri.conf.json";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { target: ["chrome111", "safari16.4", "firefox128"] },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
    "import.meta.env.VITE_APP_IDENTIFIER": JSON.stringify(identifier),
  },
  server: { port: 5173, strictPort: true },
});
