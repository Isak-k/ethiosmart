export class FirebaseError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FirebaseError';
  }
}

export function isOfflineError(error: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  const code = error?.code || '';
  const message = (error?.message || '').toLowerCase();
  return (
    code === 'auth/network-request-failed' ||
    code === 'unavailable' ||
    code === 'failed-precondition' && message.includes('offline') ||
    message.includes('network-request-failed') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('offline') ||
    message.includes('timeout')
  );
}

export function getFriendlyAuthErrorMessage(
  error: any,
  action: 'login' | 'signup' | 'reset' | 'google' = 'login'
): { title: string; description: string; isOffline: boolean } {
  if (isOfflineError(error)) {
    return {
      title: "You are currently offline",
      description: "You are offline. Please connect to the internet to sign in or create an account.",
      isOffline: true,
    };
  }

  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        title: "Sign in failed",
        description: "Invalid email or password. Please verify your credentials and try again.",
        isOffline: false,
      };
    case 'auth/email-already-in-use':
      return {
        title: "Account already exists",
        description: "An account with this email address already exists. Please sign in instead.",
        isOffline: false,
      };
    case 'auth/weak-password':
      return {
        title: "Password too weak",
        description: "Password must be at least 6 characters.",
        isOffline: false,
      };
    case 'auth/invalid-email':
      return {
        title: "Invalid email",
        description: "Please enter a valid email address.",
        isOffline: false,
      };
    case 'auth/too-many-requests':
      return {
        title: "Too many attempts",
        description: "Access temporarily blocked due to too many failed attempts. Please try again later.",
        isOffline: false,
      };
    case 'auth/popup-closed-by-user':
      return {
        title: "Sign-in cancelled",
        description: "The Google sign-in window was closed before completing.",
        isOffline: false,
      };
    case 'auth/popup-blocked':
      return {
        title: "Popup blocked",
        description: "Your browser blocked the Google sign-in popup. Please allow popups for this site.",
        isOffline: false,
      };
    default: {
      const defaultTitle = action === 'signup' 
        ? "Sign up failed" 
        : action === 'google' 
        ? "Google sign-in failed"
        : action === 'reset'
        ? "Reset failed"
        : "Sign in failed";

      const rawMsg = error?.message || "An unexpected error occurred. Please try again.";
      // Clean up raw Firebase error prefixes/suffixes for human readability
      const cleanMsg = rawMsg
        .replace(/^Firebase:\s*/i, '')
        .replace(/\s*\(auth\/[^)]+\)\.?/i, '')
        .trim();

      return {
        title: defaultTitle,
        description: cleanMsg || "Please check your details and try again.",
        isOffline: false,
      };
    }
  }
}

export function handleFirebaseError(error: any): string {
  if (isOfflineError(error)) {
    return 'You are currently offline. Please connect to the internet and try again.';
  }

  // Authentication errors
  if (error.code?.startsWith('auth/')) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Email already registered. Please login.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'You are currently offline. Please check your connection.';
      default:
        return 'Authentication error. Please try again.';
    }
  }
  
  // Firestore errors
  if (error.code?.startsWith('firestore/') || error.code === 'permission-denied') {
    switch (error.code) {
      case 'permission-denied':
        return "You don't have permission for this action.";
      case 'not-found':
        return 'Resource not found.';
      case 'already-exists':
        return 'This item already exists.';
      case 'failed-precondition':
        return 'Operation cannot be completed.';
      case 'unavailable':
        return 'Service temporarily unavailable. Please retry.';
      default:
        return 'Database error. Please try again.';
    }
  }
  
  // Storage errors
  if (error.code?.startsWith('storage/')) {
    switch (error.code) {
      case 'storage/unauthorized':
        return "You don't have permission to upload files.";
      case 'storage/canceled':
        return 'Upload canceled.';
      default:
        return 'Upload failed. Please try again.';
    }
  }
  
  // Generic error
  return error.message || 'An unexpected error occurred.';
}

// Usage in components
export async function safeFirebaseCall<T>(
  operation: () => Promise<T>,
  errorCallback?: (message: string) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const message = handleFirebaseError(error);
    if (errorCallback) {
      errorCallback(message);
    } else {
      console.error(message, error);
    }
    return null;
  }
}