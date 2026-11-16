import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { User, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/integrations/firebase/client";
import { getUserRole, getUserProfile, AppRole } from "@/lib/auth";
import { UserPermissions } from "@/types/permissions";
import { 
  saveSession, 
  getStoredSession, 
  clearSession, 
  refreshSessionExpiry,
  hasValidSession,
  getSessionRestoreData 
} from "@/lib/session-persistence-v2";
import { 
  setOfflineSession, 
  clearOfflineSession,
  setupOnlineOfflineListeners,
  getOfflineModeInfo,
  initOfflineState 
} from "@/lib/offline-state";
import {
  subscribeToSystemSettings,
  getCachedRequireStudentLogin,
  isStudentLoginRequired,
  getCachedDefaultDepartmentId
} from "@/lib/system-settings";
import {
  getStoredGuestProfile,
  saveGuestProfile,
  isGuestProfileComplete,
  GuestProfile,
  GUEST_PROFILE_CHANGED_EVENT,
  GUEST_AUTH_EMAIL,
  GUEST_AUTH_PASSWORD
} from "@/lib/guest-session";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role?: AppRole;
  departmentId?: string;
  sectionPermissions?: any; // Add section permissions
  permissions?: UserPermissions | null;
  paymentAccess?: { lifetime?: boolean; source?: string; grantedAt?: unknown } | null;
  isGuest?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: { user: User } | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  isOfflineMode: boolean;
  offlineModeInfo: ReturnType<typeof getOfflineModeInfo>;
  refreshProfile: () => Promise<void>;
  // Guest & Student Access Mode extensions
  isGuest: boolean;
  requireStudentLogin: boolean;
  updateGuestProfile: (data: { full_name: string; departmentId: string; departmentName?: string }) => void;
  continueAsGuest: () => Promise<void>;
}

// Global flag to track if auth has been initialized across component remounts
let globalAuthInitialized = false;

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  refreshProfile: async () => {},
  isGuest: false,
  requireStudentLogin: true,
  updateGuestProfile: () => {},
  continueAsGuest: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineModeInfo, setOfflineModeInfo] = useState(getOfflineModeInfo());
  const [isGuest, setIsGuest] = useState(false);
  const [requireStudentLogin, setRequireStudentLogin] = useState<boolean>(getCachedRequireStudentLogin());

  // Initialize loading to false if we've already initialized once (prevents flickering on re-mounts)
  const [loading, setLoading] = useState(!globalAuthInitialized);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupListenerRef = useRef<(() => void) | null>(null);

  // Helper to construct a synthetic guest user and profile
  const applyGuestProfile = useCallback((gp: GuestProfile | null) => {
    if (gp) {
      const activeUser = auth?.currentUser && (auth.currentUser.email === GUEST_AUTH_EMAIL || auth.currentUser.isAnonymous)
        ? auth.currentUser
        : ({
            uid: gp.id,
            isAnonymous: true,
            email: gp.email,
            displayName: gp.full_name,
          } as unknown as User);

      setUser(activeUser);
      setSession({ user: activeUser });
      setProfile({
        id: gp.id,
        user_id: gp.id,
        full_name: gp.full_name,
        email: gp.email,
        avatar_url: null,
        role: 'student',
        departmentId: gp.departmentId,
        isGuest: true,
      });
      setRole('student');
      setIsGuest(true);
    }
  }, []);

  // Update guest profile manually (e.g. from GuestSetupDialog)
  const updateGuestProfile = useCallback((data: { full_name: string; departmentId: string; departmentName?: string }) => {
    const saved = saveGuestProfile(data);
    applyGuestProfile(saved);
  }, [applyGuestProfile]);

  // Enter session as guest student (when allowed by administrator)
  const continueAsGuest = useCallback(async () => {
    const currentRequireLogin = getCachedRequireStudentLogin();
    if (currentRequireLogin) {
      throw new Error('Guest access is currently disabled by administrator.');
    }

    try {
      if (auth.currentUser?.email !== GUEST_AUTH_EMAIL && !auth.currentUser?.isAnonymous) {
        try {
          await signInWithEmailAndPassword(auth, GUEST_AUTH_EMAIL, GUEST_AUTH_PASSWORD);
        } catch (signInErr) {
          try {
            await createUserWithEmailAndPassword(auth, GUEST_AUTH_EMAIL, GUEST_AUTH_PASSWORD);
          } catch (createErr) {
            console.warn('Guest account fallback creation failed:', createErr);
          }
        }
      }
    } catch (authErr) {
      console.warn('Firebase guest sign-in warning:', authErr);
    }

    const stored = getStoredGuestProfile();
    if (stored) {
      applyGuestProfile(stored);
    }
  }, [applyGuestProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    if (isGuest) {
      applyGuestProfile(getStoredGuestProfile());
      return;
    }
    
    const [userProfile, userRole] = await Promise.all([
      getUserProfile(user.uid),
      getUserRole(user.uid),
    ]);
    
    setProfile(userProfile);
    setRole(userRole);
  }, [user, isGuest, applyGuestProfile]);

  useEffect(() => {
    // Initialize offline state on app start
    initOfflineState();

    // Subscribe to system settings changes in real-time
    const unsubscribeSettings = subscribeToSystemSettings((settings) => {
      const mustLogin = settings.requireStudentLogin ?? true;
      setRequireStudentLogin(mustLogin);

      // If login is NOT required and we have no logged-in user, activate guest profile
      if (!mustLogin && !auth?.currentUser) {
        const storedGuest = getStoredGuestProfile();
        if (storedGuest) {
          applyGuestProfile(storedGuest);
        }
      }
    });

    // Listen to guest profile changes from other tabs or dialogs
    const handleGuestProfileChange = (e: any) => {
      const updatedGuest = e.detail as GuestProfile | null;
      if (updatedGuest && !auth?.currentUser) {
        applyGuestProfile(updatedGuest);
      }
    };
    window.addEventListener(GUEST_PROFILE_CHANGED_EVENT, handleGuestProfileChange);

    // Set global flag to true immediately to prevent other instances from initializing loading state
    if (loading) {
      // Only set timeout if we are actually loading
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Auth loading timeout - forcing loading to false');
        setLoading(false);
        globalAuthInitialized = true;
      }, 3000);
    }

    // Try to restore session from localStorage first so returning users
    // don't have to stare at the splash while Firebase re-hydrates the session.
    const restoredData = getSessionRestoreData();
    if (restoredData && !user) {
      console.log('✓ Restored session from storage');
      setProfile(restoredData.profile as Profile);
      setRole(restoredData.role as AppRole);
      setIsOfflineMode(true);
      setOfflineModeInfo(getOfflineModeInfo());

      // Rebuild a lightweight user object from the cache so route guards work
      // immediately; Firebase replaces it with the real user once ready.
      if (restoredData.user?.uid) {
        const cachedUser = {
          uid: restoredData.user.uid,
          email: restoredData.user.email,
          displayName: restoredData.user.displayName ?? null,
          isAnonymous: false,
        } as unknown as User;
        setUser(cachedUser);
        setSession({ user: cachedUser });
      }

      // We already have everything needed to render — skip the splash.
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
      globalAuthInitialized = true;
    }

    // Setup online/offline listeners
    if (cleanupListenerRef.current === null) {
      cleanupListenerRef.current = setupOnlineOfflineListeners(
        () => {
          console.log('✓ Back online');
          setOfflineModeInfo(getOfflineModeInfo());
        },
        () => {
          console.log('⚠ Going offline');
          setIsOfflineMode(true);
          setOfflineModeInfo(getOfflineModeInfo());
        }
      );
    }

    if (!isFirebaseConfigured || !auth) {
      console.warn('Firebase is not configured. Continuing in guest mode without auth.');
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      const storedGuest = getStoredGuestProfile();
      if (storedGuest) {
        applyGuestProfile(storedGuest);
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        setIsGuest(false);
      }

      setLoading(false);
      globalAuthInitialized = true;
      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        if (cleanupListenerRef.current) {
          cleanupListenerRef.current();
        }
        unsubscribeSettings();
        window.removeEventListener(GUEST_PROFILE_CHANGED_EVENT, handleGuestProfileChange);
      };
    }

    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser ? currentUser.uid : 'No user');
      
      // Clear timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      if (currentUser) {
        setUser(currentUser);
        setSession({ user: currentUser });

        const isGuestUser = currentUser.isAnonymous || currentUser.email === GUEST_AUTH_EMAIL;

        if (isGuestUser) {
          // Guest student signed in
          const storedGuest = getStoredGuestProfile();
          const defaultDeptId = getCachedDefaultDepartmentId();
          const guestName = storedGuest?.full_name || 'Guest Student';
          const guestDeptId = storedGuest?.departmentId || defaultDeptId || '';

          setProfile({
            id: storedGuest?.id || currentUser.uid,
            user_id: storedGuest?.id || currentUser.uid,
            full_name: guestName,
            email: 'guest@exampro.local',
            avatar_url: null,
            role: 'student',
            departmentId: guestDeptId,
            isGuest: true,
          });
          setRole('student');
          setIsGuest(true);
        } else {
          // Normal email/password user (admin or student with account)
          setIsGuest(false);

          try {
            const [userProfile, userRole] = await Promise.all([
              getUserProfile(currentUser.uid),
              getUserRole(currentUser.uid),
            ]);
            
            console.log('Profile loaded:', userProfile);
            console.log('Role loaded:', userRole);

            const defaultDeptId = getCachedDefaultDepartmentId();
            const effectiveProfile = userProfile ? {
              ...userProfile,
              departmentId: userProfile.departmentId || (userRole === 'student' ? defaultDeptId || undefined : undefined),
            } : null;

            setProfile(effectiveProfile);
            setRole(userRole);
            
            // Save session to persistent storage (30-day expiry)
            saveSession(currentUser, userProfile, userRole);
            
            // Also save to offline state for offline access
            setOfflineSession(userProfile);
            
            // Disable offline mode when logged in and online
            if (navigator.onLine) {
              setIsOfflineMode(false);
            }
          } catch (error) {
            console.error('Error loading profile:', error);
            setProfile(null);
            setRole(null);
          }
        }
      } else {
        // No Firebase user logged in
        clearSession();
        clearOfflineSession();
        setIsOfflineMode(false);

        // Check if student login is not required (Open Access mode)
        const currentRequireLogin = getCachedRequireStudentLogin();
        if (!currentRequireLogin) {
          try {
            await signInWithEmailAndPassword(auth, GUEST_AUTH_EMAIL, GUEST_AUTH_PASSWORD);
            return;
          } catch (guestErr) {
            console.warn('Guest sign-in fallback attempt:', guestErr);
            try {
              await createUserWithEmailAndPassword(auth, GUEST_AUTH_EMAIL, GUEST_AUTH_PASSWORD);
              return;
            } catch (createErr) {
              console.warn('Guest account creation failed:', createErr);
            }
            const storedGuest = getStoredGuestProfile();
            if (storedGuest) {
              applyGuestProfile(storedGuest);
            } else {
              setUser(null);
              setSession(null);
              setProfile(null);
              setRole(null);
              setIsGuest(true);
            }
          }
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
          setRole(null);
          setIsGuest(false);
        }
      }
      
      setLoading(false);
      globalAuthInitialized = true;
    });

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (cleanupListenerRef.current) {
        cleanupListenerRef.current();
      }
      unsubscribe();
      unsubscribeSettings();
      window.removeEventListener(GUEST_PROFILE_CHANGED_EVENT, handleGuestProfileChange);
    };
  }, [applyGuestProfile]);

  const value = useMemo(() => ({ 
    user, 
    session, 
    profile, 
    role, 
    loading, 
    isOfflineMode, 
    offlineModeInfo, 
    refreshProfile,
    isGuest,
    requireStudentLogin,
    updateGuestProfile,
    continueAsGuest,
  }), [
    user, 
    session, 
    profile, 
    role, 
    loading, 
    isOfflineMode, 
    offlineModeInfo, 
    refreshProfile,
    isGuest,
    requireStudentLogin,
    updateGuestProfile,
    continueAsGuest,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
