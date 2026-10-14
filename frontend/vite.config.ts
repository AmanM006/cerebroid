import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// In development the API is proxied through the Vite server, so the browser sees
// one origin: the HttpOnly refresh cookie works without any CORS configuration.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/ready": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
})
