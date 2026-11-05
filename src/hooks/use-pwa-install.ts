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
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('pwa_install_dismissed') === 'true';
  });

  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    setInstallModalOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa_install_dismissed', 'true');
      window.dispatchEvent(new CustomEvent('pwa-install-dismissed'));
    }
  }, []);

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
    const handlePromptAvailable = (e: any) => {
      const p = e?.detail || cachedDeferredPrompt || (window as any).__pwaInstallPrompt;
      cachedDeferredPrompt = p;
      setDeferredPrompt(p);
    };

    const directHandler = (e: Event) => {
      e.preventDefault();
      cachedDeferredPrompt = e;
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handleInstalled = () => {
      setIsStandalone(true);
      cachedDeferredPrompt = null;
      if (typeof window !== 'undefined') (window as any).__pwaInstallPrompt = null;
      setDeferredPrompt(null);
      setInstallModalOpen(false);
    };

    const handleDismissed = () => {
      setIsDismissed(true);
      setInstallModalOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissInstall();
      }
    };

    window.addEventListener('beforeinstallprompt', directHandler);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('pwa-installed-success', handleInstalled);
    window.addEventListener('pwa-install-dismissed', handleDismissed);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('beforeinstallprompt', directHandler);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('pwa-installed-success', handleInstalled);
      window.removeEventListener('pwa-install-dismissed', handleDismissed);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissInstall]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    // Open the guidance modal explaining how to enable offline study access
    setInstallModalOpen(true);

    const prompt =
      deferredPrompt ||
      cachedDeferredPrompt ||
      (typeof window !== 'undefined' ? (window as any).__pwaInstallPrompt : null);

    if (prompt && typeof prompt.prompt === 'function') {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsStandalone(true);
          cachedDeferredPrompt = null;
          if (typeof window !== 'undefined') (window as any).__pwaInstallPrompt = null;
          setDeferredPrompt(null);
          setInstallModalOpen(false);
          return true;
        }
        return false;
      } catch (err) {
        console.warn('Install prompt execution error:', err);
        return false;
      }
    }
    return false;
  }, [deferredPrompt]);

  return {
    isStandalone,
    canInstall: !isStandalone && !isDismissed,
    isIOS,
    deferredPrompt,
    promptInstall,
    installModalOpen,
    setInstallModalOpen,
    isDismissed,
    dismissInstall,
  };
}
