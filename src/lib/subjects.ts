import { db } from "@/integrations/firebase/client";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { Subject, Chapter } from "@/types/subject";
import { getSubjectCover } from "@/lib/subject-covers";
import { getPublishedExams } from "@/lib/firebase-exams";
import {
  saveDeviceSubjects,
  getDeviceSubjects,
  saveDeviceChapters,
  getDeviceChapters,
} from "@/lib/device-storage";

export interface SubjectInput {
  name: string;
  description?: string;
  coverImageUrl?: string;
  coverImagePublicId?: string;
  bookCoverImageUrl?: string;
  notesCoverImageUrl?: string;
  departmentIds?: string[];
  totalUnits?: number;
  displayOrder?: number;
  isActive?: boolean;
}

const LOCAL_SUBJECTS_STORAGE_KEY = 'exampro_offline_subjects_v1';

export function isPermissionDeniedError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const message = String(err.message || '');
  return (
    code === 'permission-denied' ||
    code.includes('permission-denied') ||
    message.includes('insufficient permissions') ||
    message.includes('Missing or insufficient permissions')
  );
}

export function getStoredLocalSubjects(): Subject[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_SUBJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      let displayOrder =
        item.displayOrder !== undefined && item.displayOrder !== null && !isNaN(Number(item.displayOrder))
          ? Number(item.displayOrder)
          : undefined;

      if (displayOrder === undefined && item.name) {
        const match = DEFAULT_SUBJECTS_LIST.find(
          (sub) => sub.name.toLowerCase() === String(item.name).toLowerCase().trim()
        );
        if (match) displayOrder = match.displayOrder;
      }

      return {
        ...item,
        displayOrder,
      };
    });
  } catch {
    return [];
  }
}

export function saveStoredLocalSubjects(subjects: Subject[]): void {
  // Delegate directly to saveDeviceSubjects for unified persistent IndexedDB + compact storage
  saveDeviceSubjects(subjects).catch(() => {});
}

/**
 * Authoritative Subject Sorting:
 * 1. Primary sort: displayOrder (ascending 1, 2, 3...)
 *    - Valid numbers are sorted first in ascending order
 *    - Unspecified/missing displayOrders are placed after explicit orders
 * 2. Secondary sort: Alphabetical by name (case-insensitive tie-breaker)
 */
export function sortSubjects(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => {
    const rawA = a.displayOrder;
    const rawB = b.displayOrder;

    const hasOrderA = rawA !== undefined && rawA !== null && !isNaN(Number(rawA));
    const hasOrderB = rawB !== undefined && rawB !== null && !isNaN(Number(rawB));

    if (hasOrderA && hasOrderB) {
      const diff = Number(rawA) - Number(rawB);
      if (diff !== 0) return diff;
    } else if (hasOrderA && !hasOrderB) {
      return -1; // a comes first
    } else if (!hasOrderA && hasOrderB) {
      return 1; // b comes first
    }

    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

/**
 * Fetch subjects. If departmentId is provided, filter to subjects available to that department.
 */
export async function getSubjects(departmentId?: string): Promise<Subject[]> {
  let list: Subject[] = [];
  let fetchedFromRemote = false;

  try {
    const snapshot = await getDocs(collection(db, "subjects"));

    list = snapshot.docs.map((d) => {
      const data = d.data();
      let displayOrder =
        data.displayOrder !== undefined && data.displayOrder !== null && !isNaN(Number(data.displayOrder))
          ? Number(data.displayOrder)
          : undefined;

      if (displayOrder === undefined && data.name) {
        const match = DEFAULT_SUBJECTS_LIST.find(
          (sub) => sub.name.toLowerCase() === String(data.name).toLowerCase().trim()
        );
        if (match) displayOrder = match.displayOrder;
      }

      return {
        id: d.id,
        ...data,
        displayOrder,
      } as Subject;
    });
    fetchedFromRemote = true;

    // Cache remote subjects locally on device (IndexedDB & localStorage)
    saveStoredLocalSubjects(list);
    saveDeviceSubjects(list).catch(() => {});
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn("Firestore permissions for 'subjects' not configured in Firebase Console. Using local store.");
    } else {
      console.error("Error getting subjects from Firestore, checking device storage:", error);
    }
    // Check persistent device storage first
    try {
      const deviceList = await getDeviceSubjects(departmentId);
      if (deviceList && deviceList.length > 0) {
        list = deviceList;
      } else {
        list = getStoredLocalSubjects();
      }
    } catch {
      list = getStoredLocalSubjects();
    }

    // If local store is empty too, fallback to default subjects list
    if (list.length === 0) {
      list = DEFAULT_SUBJECTS_LIST.map((sub, idx) => ({
        id: `subj_default_${idx + 1}`,
        name: sub.name,
        description: sub.description,
        totalUnits: sub.totalUnits,
        displayOrder: sub.displayOrder,
        isActive: true,
        coverImageUrl: getSubjectCover(sub.name).url,
        departmentIds: [],
      }));
      saveStoredLocalSubjects(list);
      saveDeviceSubjects(list).catch(() => {});
    }
  }

  // Also include any local-only custom subjects if remote didn't have them
  if (fetchedFromRemote) {
    const localList = getStoredLocalSubjects();
    for (const loc of localList) {
      if (!list.some((r) => r.id === loc.id || r.name.toLowerCase() === loc.name.toLowerCase())) {
        list.push(loc);
      }
    }
  }

  // Sort authoritatively by displayOrder (1, 2, 3...) then by name
  list = sortSubjects(list);

  // If departmentId is specified (e.g. for student), filter by department visibility
  if (departmentId && departmentId !== "all") {
    // Also get published exams in this department to check for exams linked to subjects
    let departmentExams = [];
    try {
      departmentExams = await getPublishedExams(departmentId);
    } catch (err) {
      console.warn("Could not fetch department exams for subject filtering:", err);
    }

    const activeSubjectIdsFromExams = new Set(
      departmentExams
        .map((e) => (e as any).subjectId)
        .filter((id): id is string => Boolean(id))
    );

    list = list.filter((subject) => {
      // If subject is explicitly deactivated by admin, don't show
      if (subject.isActive === false) return false;

      // If subject is directly assigned to this department
      if (subject.departmentIds && subject.departmentIds.length > 0) {
        if (subject.departmentIds.includes(departmentId) || subject.departmentIds.includes('all')) {
          return true;
        }
        return false;
      }

      // Legacy single departmentId field
      if ((subject as any).departmentId === departmentId || (subject as any).departmentId === 'all') {
        return true;
      }

      // If subject has published exams in this student's department
      if (activeSubjectIdsFromExams.has(subject.id)) {
        return true;
      }

      // Strict department assignment rule: unassigned subjects are NOT visible to students with a department
      return false;
    });
  }

  return list;
}

/**
 * Get single subject by ID
 */
export async function getSubject(id: string): Promise<Subject | null> {
  try {
    const docRef = doc(db, "subjects", id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as Subject;
    }
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.warn("Error getting subject from Firestore, checking local storage:", error);
    }
  }

  // Fallback to local store
  const localList = getStoredLocalSubjects();
  return localList.find((s) => s.id === id) || null;
}

/**
 * Create a new subject in the 'subjects' collection
 */
export async function createSubject(input: SubjectInput, userId?: string): Promise<string> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Subject name is required");
  }

  // Check duplicate against local subjects first
  const localSubjects = getStoredLocalSubjects();
  if (localSubjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A subject named "${name}" already exists.`);
  }

  const payload: Record<string, any> = {
    name,
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (userId) payload.createdBy = userId;
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.coverImageUrl !== undefined) payload.coverImageUrl = input.coverImageUrl.trim();
  if (input.coverImagePublicId !== undefined) payload.coverImagePublicId = input.coverImagePublicId.trim();
  if (input.bookCoverImageUrl !== undefined) payload.bookCoverImageUrl = input.bookCoverImageUrl.trim();
  if (input.notesCoverImageUrl !== undefined) payload.notesCoverImageUrl = input.notesCoverImageUrl.trim();
  if (input.departmentIds !== undefined) payload.departmentIds = input.departmentIds;
  if (input.totalUnits !== undefined && !isNaN(Number(input.totalUnits))) {
    payload.totalUnits = Math.max(0, Number(input.totalUnits));
  }
  if (input.displayOrder !== undefined && !isNaN(Number(input.displayOrder))) {
    payload.displayOrder = Number(input.displayOrder);
  } else {
    const existing = getStoredLocalSubjects();
    const maxOrder = existing.reduce((max, s) => {
      const o = Number(s.displayOrder);
      return !isNaN(o) ? Math.max(max, o) : max;
    }, 0);
    payload.displayOrder = maxOrder + 1;
  }

  try {
    // 1. Check duplicate name in Firestore
    const q = query(collection(db, "subjects"), where("name", "==", name));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error(`A subject named "${name}" already exists.`);
    }

    // 2. Add document to Firestore
    const docRef = await addDoc(collection(db, "subjects"), payload);
    const savedSubject: Subject = {
      id: docRef.id,
      ...payload,
    };
    saveStoredLocalSubjects([...localSubjects, savedSubject]);
    return docRef.id;
  } catch (error: any) {
    // If Firestore rules reject write (permission-denied), gracefully store locally
    if (isPermissionDeniedError(error)) {
      console.warn(
        "Firestore permission-denied for 'subjects'. Saving locally. Update Firestore rules in Firebase Console to sync with cloud."
      );
      const localId = `subj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const localSubject: Subject = {
        id: localId,
        ...payload,
      };
      saveStoredLocalSubjects([...localSubjects, localSubject]);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("exampro:subject-permission-notice", {
            detail: {
              subjectId: localId,
              subjectName: name,
            },
          })
        );
      }

      return localId;
    }

    console.error("Error creating subject:", error);
    throw error;
  }
}

/**
 * Update an existing subject
 */
export async function updateSubject(id: string, input: Partial<SubjectInput>): Promise<void> {
  const parsedDisplayOrder =
    input.displayOrder !== undefined && !isNaN(Number(input.displayOrder))
      ? Number(input.displayOrder)
      : undefined;

  // Update local cache
  const localSubjects = getStoredLocalSubjects();
  const index = localSubjects.findIndex((s) => s.id === id);
  if (index !== -1) {
    localSubjects[index] = {
      ...localSubjects[index],
      ...input,
      ...(parsedDisplayOrder !== undefined ? { displayOrder: parsedDisplayOrder } : {}),
    };
    saveStoredLocalSubjects(localSubjects);
  }

  try {
    const docRef = doc(db, "subjects", id);
    const payload: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };

    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.description !== undefined) payload.description = input.description.trim();
    if (input.coverImageUrl !== undefined) payload.coverImageUrl = input.coverImageUrl ? input.coverImageUrl.trim() : null;
    if (input.coverImagePublicId !== undefined) payload.coverImagePublicId = input.coverImagePublicId ? input.coverImagePublicId.trim() : null;
    if (input.bookCoverImageUrl !== undefined) payload.bookCoverImageUrl = input.bookCoverImageUrl ? input.bookCoverImageUrl.trim() : null;
    if (input.notesCoverImageUrl !== undefined) payload.notesCoverImageUrl = input.notesCoverImageUrl ? input.notesCoverImageUrl.trim() : null;
    if (input.departmentIds !== undefined) payload.departmentIds = input.departmentIds;
    if (input.totalUnits !== undefined) {
      payload.totalUnits = isNaN(Number(input.totalUnits)) ? 0 : Math.max(0, Number(input.totalUnits));
    }
    if (parsedDisplayOrder !== undefined) {
      payload.displayOrder = parsedDisplayOrder;
    }
    if (input.isActive !== undefined) payload.isActive = Boolean(input.isActive);

    await updateDoc(docRef, payload);
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn("Firestore update permission denied; updated locally:", error);
      return;
    }
    console.error("Error updating subject:", error);
    throw error;
  }
}

/**
 * Delete a subject
 */
export async function deleteSubject(id: string): Promise<void> {
  // Remove from local cache
  const localSubjects = getStoredLocalSubjects();
  saveStoredLocalSubjects(localSubjects.filter((s) => s.id !== id));

  try {
    const docRef = doc(db, "subjects", id);
    await deleteDoc(docRef);
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn("Firestore delete permission denied; deleted locally:", error);
      return;
    }
    console.error("Error deleting subject:", error);
    throw error;
  }
}

/**
 * Associate a subject with a department if not already associated
 */
export async function addDepartmentToSubject(subjectId: string, departmentId: string): Promise<void> {
  if (!subjectId || !departmentId || departmentId === "all") return;
  try {
    const subject = await getSubject(subjectId);
    if (!subject) return;

    const existingDepts = subject.departmentIds || [];
    if (!existingDepts.includes(departmentId)) {
      await updateDoc(doc(db, "subjects", subjectId), {
        departmentIds: [...existingDepts, departmentId],
        updatedAt: Timestamp.now(),
      });
    }
  } catch (err) {
    console.warn("Could not associate department with subject:", err);
  }
}

/**
 * Fetch chapters under a subject
 */
export async function getChapters(subjectId: string): Promise<Chapter[]> {
  try {
    const q = query(
      collection(db, `subjects/${subjectId}/chapters`),
      orderBy("chapterNumber", "asc")
    );
    const snapshot = await getDocs(q);
    const chapters = snapshot.docs.map((d) => ({
      id: d.id,
      subjectId,
      ...d.data(),
    } as Chapter));

    // Cache chapters on device
    saveDeviceChapters(subjectId, chapters).catch(() => {});
    return chapters;
  } catch (error) {
    // If ordering by chapterNumber fails due to missing index, fallback to unordered
    try {
      const fallbackSnapshot = await getDocs(collection(db, `subjects/${subjectId}/chapters`));
      const fallbackChapters = fallbackSnapshot.docs.map((d) => ({
        id: d.id,
        subjectId,
        ...d.data(),
      } as Chapter));

      saveDeviceChapters(subjectId, fallbackChapters).catch(() => {});
      return fallbackChapters;
    } catch {
      // Offline fallback: load chapters from device storage!
      try {
        const storedChapters = await getDeviceChapters(subjectId);
        if (storedChapters && storedChapters.length > 0) {
          return storedChapters;
        }
      } catch {
        // ignore
      }
      return [];
    }
  }
}

/**
 * Create a chapter under a subject
 */
export async function createChapter(
  subjectId: string,
  title: string,
  chapterNumber?: number,
  description?: string
): Promise<string> {
  try {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("Chapter title is required");

    const payload: Record<string, any> = {
      title: cleanTitle,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    if (chapterNumber !== undefined) payload.chapterNumber = Number(chapterNumber);
    if (description) payload.description = description.trim();

    const docRef = await addDoc(collection(db, `subjects/${subjectId}/chapters`), payload);
    return docRef.id;
  } catch (error) {
    console.error("Error creating chapter:", error);
    throw error;
  }
}

/**
 * Update an existing chapter under a subject
 */
export async function updateChapter(
  subjectId: string,
  chapterId: string,
  input: { title?: string; chapterNumber?: number; description?: string }
): Promise<void> {
  try {
    const docRef = doc(db, `subjects/${subjectId}/chapters`, chapterId);
    const payload: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };

    if (input.title !== undefined) {
      const cleanTitle = input.title.trim();
      if (!cleanTitle) throw new Error("Chapter title cannot be empty");
      payload.title = cleanTitle;
    }
    if (input.chapterNumber !== undefined) payload.chapterNumber = Number(input.chapterNumber);
    if (input.description !== undefined) payload.description = input.description.trim();

    await updateDoc(docRef, payload);
  } catch (error) {
    console.error("Error updating chapter:", error);
    throw error;
  }
}

/**
 * Delete a chapter under a subject
 */
export async function deleteChapter(subjectId: string, chapterId: string): Promise<void> {
  try {
    const docRef = doc(db, `subjects/${subjectId}/chapters`, chapterId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting chapter:", error);
    throw error;
  }
}

/**
 * Seed standard default subjects
 */
export const DEFAULT_SUBJECTS_LIST = [
  { name: "Mathematics", totalUnits: 10, description: "Algebra, calculus, geometry, and problem solving", displayOrder: 1 },
  { name: "Physics", totalUnits: 8, description: "Mechanics, thermodynamics, optics, and modern physics", displayOrder: 2 },
  { name: "Chemistry", totalUnits: 9, description: "Organic, inorganic, physical, and analytical chemistry", displayOrder: 3 },
  { name: "Biology", totalUnits: 8, description: "Cell biology, genetics, ecology, and human physiology", displayOrder: 4 },
  { name: "English", totalUnits: 10, description: "Grammar, reading comprehension, writing, and literature", displayOrder: 5 },
  { name: "History", totalUnits: 8, description: "World history, ancient civilizations, and national heritage", displayOrder: 6 },
  { name: "Geography", totalUnits: 7, description: "Physical geography, map reading, climates, and human systems", displayOrder: 7 },
  { name: "Economics", totalUnits: 8, description: "Microeconomics, macroeconomics, markets, and monetary systems", displayOrder: 8 },
  { name: "Civics", totalUnits: 6, description: "Democratic governance, constitutional principles, and ethics", displayOrder: 9 },
];

export async function seedDefaultSubjects(departmentIds?: string[]): Promise<number> {
  try {
    const existing = await getSubjects();
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase().trim()));
    const batch = writeBatch(db);
    let addedCount = 0;

    for (const sub of DEFAULT_SUBJECTS_LIST) {
      if (!existingNames.has(sub.name.toLowerCase().trim())) {
        const cover = getSubjectCover(sub.name);
        const newDocRef = doc(collection(db, "subjects"));
        batch.set(newDocRef, {
          name: sub.name,
          description: sub.description,
          totalUnits: sub.totalUnits,
          displayOrder: sub.displayOrder,
          isActive: true,
          coverImageUrl: cover.url,
          departmentIds: departmentIds || [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await batch.commit();
    }
    return addedCount;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn("Firestore seed permission denied. Seeding into local store:", error);
      const existing = getStoredLocalSubjects();
      const existingNames = new Set(existing.map((s) => s.name.toLowerCase().trim()));
      const toAdd: Subject[] = [];

      DEFAULT_SUBJECTS_LIST.forEach((sub, idx) => {
        if (!existingNames.has(sub.name.toLowerCase().trim())) {
          toAdd.push({
            id: `subj_seed_${idx + 1}`,
            name: sub.name,
            description: sub.description,
            totalUnits: sub.totalUnits,
            displayOrder: sub.displayOrder,
            isActive: true,
            coverImageUrl: getSubjectCover(sub.name).url,
            departmentIds: departmentIds || [],
          });
        }
      });

      if (toAdd.length > 0) {
        saveStoredLocalSubjects([...existing, ...toAdd]);
      }
      return toAdd.length;
    }
    console.error("Error seeding default subjects:", error);
    throw error;
  }
}
