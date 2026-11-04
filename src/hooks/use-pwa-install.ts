import { useState, useEffect, useCallback } from 'react';

// Global cache for beforeinstallprompt event so it is never lost across route changes
let cachedDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedDeferredPrompt = e;
    (window as any).__pwaInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
  });

  window.addEventListener('appinstalled', () => {
    cachedDeferredPrompt = null;
    (window as any).__pwaInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed-success'));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => cachedDeferredPrompt || (typeof window !== 'undefined' ? (window as any).__pwaInstallPrompt : null));
  const [isIOS, setIsIOS] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  // Standalone check: only true when actually running inside the installed PWA window
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.startsWith('android-app://')
    );
  });

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = Boolean(
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.startsWith('android-app://')
      );
      setIsStandalone(standalone);
    };

    checkStandalone();

    // Check if iOS device
    const iOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(Boolean(iOSDevice));

    // Listen to display-mode change
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
      }
    };
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    // Listen for custom beforeinstallprompt event
    const handlePromptAvailable = () => {
      setDeferredPrompt(cachedDeferredPrompt || (window as any).__pwaInstallPrompt);
    };

    const handleInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setInstallModalOpen(false);
    };

    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('pwa-installed-success', handleInstalled);

    return () => {
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('pwa-installed-success', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const prompt = deferredPrompt || cachedDeferredPrompt || (typeof window !== 'undefined' ? (window as any).__pwaInstallPrompt : null);

    if (prompt) {
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsStandalone(true);
          cachedDeferredPrompt = null;
          setDeferredPrompt(null);
          setInstallModalOpen(false);
          return true;
        }
        cachedDeferredPrompt = null;
        setDeferredPrompt(null);
        return false;
      } catch (err) {
        console.warn('Install prompt execution error:', err);
        setInstallModalOpen(true);
        return false;
      }
    } else {
      // If native deferred prompt is not directly supported/available (e.g. iOS Safari, Firefox, or Chrome desktop), open instructions modal
      setInstallModalOpen(true);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isStandalone,
    canInstall: !isStandalone,
    isIOS,
    deferredPrompt,
    promptInstall,
    installModalOpen,
    setInstallModalOpen,
  };
}
