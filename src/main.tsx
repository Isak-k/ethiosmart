import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION, ensureFreshContent, triggerManualAppRefresh } from "@/lib/content-refresh";

// Bootstrap: check whether this device is running the latest build and, if not,
// invalidate stale content caches *before* the first render so users never see
// outdated content first. Guarded so it can never block or crash startup.
async function bootstrap() {
  let didReset = false;
  try {
    didReset = await ensureFreshContent();
  } catch (err) {
    console.warn("Content freshness check skipped:", err);
  }

  createRoot(document.getElementById("root")!).render(<App />);

  if (didReset) {
    // Views that already mounted should re-fetch the latest data from the server.
    setTimeout(() => {
      try {
        triggerManualAppRefresh();
      } catch {
        // ignore
      }
    }, 0);
  }
}

bootstrap();

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Capture whether a service worker was already in control, so we only reload
    // when an *update* activates — never on the very first install.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshed = false;

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`, { scope: '/' })
        .then((registration) => {
          setInterval(() => {
            registration.update();
          }, 60000);
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                // New version is ready — activate it immediately.
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        })
        .catch(() => {});
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshed) return;
      refreshed = true;
      window.location.reload();
    });
  } else {
    // Local development: never let a stale production service worker poison the
    // dev server with outdated builds. Unregister every SW and purge its caches.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const registration of regs) {
        registration.unregister();
      }
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }
  }
}

// Handle online/offline events
window.addEventListener('online', () => {
  console.log('✓ Back online');
  document.body.classList.remove('offline');
  document.body.classList.add('online');
});

window.addEventListener('offline', () => {
  console.log('⚠ Offline mode');
  document.body.classList.remove('online');
  document.body.classList.add('offline');
});

// Set initial state
if (navigator.onLine) {
  document.body.classList.add('online');
} else {
  document.body.classList.add('offline');
}
