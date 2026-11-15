/// <reference types="vite/client" />

/**
 * Unique id injected at build time by Vite (`define` in vite.config.ts).
 * Changes on every build so the app can detect a new version on launch.
 */
declare const __APP_VERSION__: string;
