/**
 * Protected Firebase Admin Functions with Permission Validation
 * These functions enforce permissions before executing sensitive operations
 */

import { db, firebaseConfig } from "@/integrations/firebase/client";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp
} from "firebase/firestore";
import { UserProfile } from "@/integrations/firebase/types";
import { initializeApp, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from "firebase/auth";
import { enforcePermission } from "./permission-middleware";

/**
 * Create examiner account with permission check
 * Requires: addExaminers permission
 */
export async function createExaminerAccountProtected(
  currentUser: UserProfile | null | undefined,
  email: string,
  password: string,
  name: string
) {
  // Enforce permission
  enforcePermission(currentUser, 'addExaminers');

  let secondaryApp;
  try {
    secondaryApp = getApp("SecondaryApp");
  } catch (e) {
    secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
  }
  
  const secondaryAuth = getAuth(secondaryApp);
  await setPersistence(secondaryAuth, inMemoryPersistence);

  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = userCredential.user;

    const userProfile = {
      userId: user.uid,
      email: user.email!,
      fullName: name,
      avatarUrl: null,
      role: 'admin',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    await signOut(secondaryAuth);
    
    return user.uid;
  } catch (error) {
    console.error("Error creating examiner:", error);
    throw error;
  }
}

/**
 * Update examiner with permission check
 * Requires: editExaminerPermissions permission
 */
export async function updateExaminerProtected(
  currentUser: UserProfile | null | undefined,
  userId: string,
  updates: Partial<UserProfile>
) {
  // Enforce permission
  enforcePermission(currentUser, 'editExaminerPermissions');

  try {
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error updating examiner:", error);
    throw error;
  }
}

/**
 * Toggle examiner status with permission check
 * Requires: enableDisableExaminers permission
 */
export async function toggleExaminerStatusProtected(
  currentUser: UserProfile | null | undefined,
  userId: string,
  disabled: boolean
) {
  // Enforce permission
  enforcePermission(currentUser, 'enableDisableExaminers');

  try {
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, {
      disabled,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error toggling examiner status:", error);
    throw error;
  }
}

/**
 * Delete examiner with permission check
 * Requires: deleteExaminers permission
 */
export async function deleteExaminerProtected(
  currentUser: UserProfile | null | undefined,
  userId: string
) {
  // Enforce permission
  enforcePermission(currentUser, 'deleteExaminers');

  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (error) {
    console.error("Error deleting examiner:", error);
    throw error;
  }
}

/**
 * Get examiners (no permission check needed - read-only)
 */
export async function getExaminersProtected(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", "admin"));
    const snapshot = await getDocs(q);
    
    const examiners: UserProfile[] = [];
    snapshot.forEach((doc) => {
      examiners.push(doc.data() as UserProfile);
    });
    
    return examiners;
  } catch (error) {
    console.error("Error getting examiners:", error);
    throw error;
  }
}
