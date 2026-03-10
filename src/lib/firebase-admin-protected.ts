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
import { UserPermissions, SUPER_ADMIN_EMAIL } from "@/types/permissions";
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

/**
 * Delete exam with permission check
 * Requires: deleteExams permission
 */
export async function deleteExamProtected(
  currentUser: UserProfile | null | undefined,
  examId: string,
  examCreatorId?: string
) {
  // Check if user has permission to delete exams
  if (!currentUser) {
    throw new Error('Permission denied: User not authenticated');
  }

  // Super admin can delete any exam
  if (currentUser.role === 'superadmin') {
    try {
      await deleteDoc(doc(db, "exams", examId));
    } catch (error) {
      console.error("Error deleting exam:", error);
      throw error;
    }
    return;
  }

  // Regular admin needs deleteExams permission
  enforcePermission(currentUser, 'deleteExams');

  try {
    await deleteDoc(doc(db, "exams", examId));
  } catch (error) {
    console.error("Error deleting exam:", error);
    throw error;
  }
}

/**
 * Update exam with permission check
 * Requires: editExams permission
 */
export async function updateExamProtected(
  currentUser: UserProfile | null | undefined,
  examId: string,
  updates: any,
  examCreatorId?: string
) {
  // Check if user has permission to edit exams
  if (!currentUser) {
    throw new Error('Permission denied: User not authenticated');
  }

  // Super admin can edit any exam
  if (currentUser.role === 'superadmin') {
    try {
      await updateDoc(doc(db, "exams", examId), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error("Error updating exam:", error);
      throw error;
    }
    return;
  }

  // Regular admin needs editExams permission
  enforcePermission(currentUser, 'editExams');

  try {
    await updateDoc(doc(db, "exams", examId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    throw error;
  }
}

/**
 * Publish/Unpublish exam with permission check
 * Requires: publishExams permission
 */
export async function publishExamProtected(
  currentUser: UserProfile | null | undefined,
  examId: string,
  isPublished: boolean
) {
  enforcePermission(currentUser, 'publishExams');

  try {
    await updateDoc(doc(db, "exams", examId), {
      isPublished,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error publishing exam:", error);
    throw error;
  }
}

/**
 * Delete student with permission check
 * Requires: deleteStudents permission
 */
export async function deleteStudentProtected(
  currentUser: UserProfile | null | undefined,
  studentId: string
) {
  enforcePermission(currentUser, 'deleteStudents');

  try {
    await deleteDoc(doc(db, "users", studentId));
  } catch (error) {
    console.error("Error deleting student:", error);
    throw error;
  }
}

/**
 * Update student with permission check
 * Requires: editStudents permission
 */
export async function updateStudentProtected(
  currentUser: UserProfile | null | undefined,
  studentId: string,
  updates: any
) {
  enforcePermission(currentUser, 'editStudents');

  try {
    await updateDoc(doc(db, "users", studentId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error updating student:", error);
    throw error;
  }
}

/**
 * Add student with permission check
 * Requires: addStudents permission
 */
export async function addStudentProtected(
  currentUser: UserProfile | null | undefined,
  studentData: any
) {
  enforcePermission(currentUser, 'addStudents');

  try {
    const userRef = doc(db, "users", studentData.userId);
    await setDoc(userRef, {
      ...studentData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error adding student:", error);
    throw error;
  }
}

/**
 * Export results with permission check
 * Requires: exportResults permission
 */
export async function exportResultsProtected(
  currentUser: UserProfile | null | undefined,
  resultsData: any
) {
  enforcePermission(currentUser, 'exportResults');

  // This function just validates permission
  // The actual export logic is handled by the caller
  return resultsData;
}

/**
 * View all results with permission check
 * Requires: viewAllResults permission
 */
export async function viewAllResultsProtected(
  currentUser: UserProfile | null | undefined
) {
  enforcePermission(currentUser, 'viewAllResults');

  // This function just validates permission
  // The actual fetch logic is handled by the caller
  return true;
}

/**
 * Manage leaderboard with permission check
 * Requires: manageLeaderboard permission
 */
export async function manageLeaderboardProtected(
  currentUser: UserProfile | null | undefined,
  leaderboardData: any
) {
  enforcePermission(currentUser, 'manageLeaderboard');

  // This function just validates permission
  // The actual update logic is handled by the caller
  return leaderboardData;
}

/**
 * Disable/Enable exam with permission check
 * Requires: disableExams permission
 */
export async function disableExamProtected(
  currentUser: UserProfile | null | undefined,
  examId: string,
  disabled: boolean
) {
  enforcePermission(currentUser, 'disableExams');

  try {
    await updateDoc(doc(db, "exams", examId), {
      disabled,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error disabling exam:", error);
    throw error;
  }
}

/**
 * Disable/Enable student with permission check
 * Requires: disableStudents permission
 */
export async function disableStudentProtected(
  currentUser: UserProfile | null | undefined,
  studentId: string,
  disabled: boolean
) {
  enforcePermission(currentUser, 'disableStudents');

  try {
    await updateDoc(doc(db, "users", studentId), {
      disabled,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error disabling student:", error);
    throw error;
  }
}

/**
 * Delete exam attempt with permission check
 * Requires: deleteExams permission (since results are tied to exams)
 */
export async function deleteAttemptProtected(
  currentUser: UserProfile | null | undefined,
  attemptId: string
) {
  // Check if user is authenticated
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Check if user is disabled
  if (currentUser.disabled === true) {
    throw new Error('User account is disabled');
  }

  // Super admin has all permissions (check by email)
  if (currentUser.email === SUPER_ADMIN_EMAIL) {
    try {
      const docRef = doc(db, 'examAttempts', attemptId);
      await deleteDoc(docRef);
      return;
    } catch (error) {
      console.error("Error deleting attempt:", error);
      throw error;
    }
  }

  // Super admin has all permissions (check by role for backward compatibility)
  if (currentUser.role === 'superadmin') {
    try {
      const docRef = doc(db, 'examAttempts', attemptId);
      await deleteDoc(docRef);
      return;
    } catch (error) {
      console.error("Error deleting attempt:", error);
      throw error;
    }
  }

  // Only admins can delete
  if (currentUser.role !== 'admin') {
    throw new Error('User is not an admin');
  }

  // Check if user has the permission
  const userPermissions = currentUser.permissions as UserPermissions | undefined;
  
  if (!userPermissions || userPermissions.deleteResults !== true) {
    throw new Error('User lacks permission to delete results');
  }

  try {
    const docRef = doc(db, 'examAttempts', attemptId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting attempt:", error);
    throw error;
  }
}
