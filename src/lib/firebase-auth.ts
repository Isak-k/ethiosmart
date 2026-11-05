import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/integrations/firebase/client';
import { AppRole, UserProfile } from '@/integrations/firebase/types';

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: AppRole
) {
  // Create user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Create user profile in Firestore
  const userProfile: UserProfile = {
    userId: user.uid,
    email: user.email!,
    fullName,
    avatarUrl: null,
    role,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  await setDoc(doc(db, 'users', user.uid), userProfile);

  return userCredential;
}

export async function signIn(email: string, password: string) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return await firebaseSignOut(auth);
}

export async function resetPassword(email: string) {
  return await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  
  return null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'userId' | 'createdAt'>>
) {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now()
  }, { merge: true });
}

export async function signInWithGoogle(options?: { useRedirect?: boolean }) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  // Mobile browsers often block popups or drop context across tabs
  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const preferRedirect = options?.useRedirect || isMobile;

  if (preferRedirect) {
    try {
      console.log('Initiating Google sign-in with redirect...');
      await signInWithRedirect(auth, provider);
      return {
        redirectInitiated: true,
        user: null as any,
        isNewUser: false,
        needsProfileSetup: false
      };
    } catch (redirectError: any) {
      console.warn('Google signInWithRedirect error, falling back to popup:', redirectError);
      // Fall through to popup if redirect failed
    }
  }

  try {
    console.log('Initiating Google sign-in with popup...');
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user profile exists
    const userProfile = await getUserProfile(user.uid);
    
    if (!userProfile) {
      return {
        redirectInitiated: false,
        user,
        isNewUser: true,
        needsProfileSetup: true
      };
    }
    
    return {
      redirectInitiated: false,
      user,
      isNewUser: false,
      needsProfileSetup: false
    };
  } catch (popupError: any) {
    console.error('Google signInWithPopup error code:', popupError?.code, popupError?.message);
    
    // If popup blocked or cancelled on mobile, attempt redirect as safe fallback
    if (popupError?.code === 'auth/popup-blocked' || popupError?.code === 'auth/cancelled-popup-request') {
      console.log('Popup blocked/cancelled, attempting signInWithRedirect fallback...');
      await signInWithRedirect(auth, provider);
      return {
        redirectInitiated: true,
        user: null as any,
        isNewUser: false,
        needsProfileSetup: false
      };
    }
    
    throw popupError;
  }
}

/**
 * Checks for a pending Google sign-in redirect result on page mount.
 */
export async function checkGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result || !result.user) return null;

    const user = result.user;
    const userProfile = await getUserProfile(user.uid);

    if (!userProfile) {
      return {
        user,
        isNewUser: true,
        needsProfileSetup: true
      };
    }

    return {
      user,
      isNewUser: false,
      needsProfileSetup: false
    };
  } catch (error) {
    console.error('Error resolving Google redirect result:', error);
    throw error;
  }
}

export async function completeGoogleSignUpProfile(
  userId: string,
  email: string,
  fullName: string,
  departmentId: string,
  role: AppRole = 'student'
) {
  const userProfile: UserProfile = {
    userId,
    email,
    fullName,
    avatarUrl: null,
    role,
    departmentId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  await setDoc(doc(db, 'users', userId), userProfile);
  return userProfile;
}