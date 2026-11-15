import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { aiDevPlugin } from "./src/server/ai-bridge";

// Unique id per build. Bump-free: it changes on every build/deploy so the app
// can detect a new version and invalidate stale caches on launch.
const APP_BUILD_VERSION = String(Date.now());

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_BUILD_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    aiDevPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'date-fns'],
          'pdf-vendor': ['pdfjs-dist', 'jspdf', 'jspdf-autotable'],
          'charts-vendor': ['recharts'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
}));
