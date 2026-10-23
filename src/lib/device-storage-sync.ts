import { db } from '@/integrations/firebase/client';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  saveDeviceSubjects,
  saveDeviceChapters,
  saveDeviceExams,
  saveDeviceBooks,
  saveDeviceDepartments,
  updateDeviceSyncTimestamp,
  getDeviceStorageStats,
  DeviceStorageStats,
} from '@/lib/device-storage';
import { Subject, Chapter } from '@/types/subject';
import { Book } from '@/types/book';
import { Exam, Department } from '@/integrations/firebase/types';

let isSyncInProgress = false;

/**
 * Perform a background sync to store all critical student data on device
 * (Subjects, Chapters, Exams, Textbooks, Shortnotes)
 */
export async function syncAllDeviceData(userDeptId?: string): Promise<{
  success: boolean;
  stats: DeviceStorageStats;
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    const stats = await getDeviceStorageStats();
    return { success: false, stats };
  }

  if (isSyncInProgress) {
    const stats = await getDeviceStorageStats();
    return { success: true, stats };
  }

  isSyncInProgress = true;

  try {
    // 1. Sync Departments
    try {
      const deptsSnap = await getDocs(collection(db, 'departments'));
      const depts = deptsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Department[];
      if (depts.length > 0) {
        await saveDeviceDepartments(depts);
      }
    } catch (deptErr) {
      console.warn('Sync departments skipped:', deptErr);
    }

    // 2. Sync Subjects
    let syncedSubjects: Subject[] = [];
    try {
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      syncedSubjects = subjectsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Subject[];
      if (syncedSubjects.length > 0) {
        await saveDeviceSubjects(syncedSubjects);
      }
    } catch (subjErr) {
      console.warn('Sync subjects skipped:', subjErr);
    }

    // 3. Sync Chapters for each Subject (in parallel chunks of 3)
    if (syncedSubjects.length > 0) {
      const activeSubjects = syncedSubjects.filter((s) => s.isActive !== false);
      for (const subject of activeSubjects) {
        try {
          const chaptersSnap = await getDocs(collection(db, `subjects/${subject.id}/chapters`));
          const chapters = chaptersSnap.docs.map((d) => ({
            id: d.id,
            subjectId: subject.id,
            ...d.data(),
          })) as Chapter[];
          if (chapters.length > 0) {
            await saveDeviceChapters(subject.id, chapters);
          }
        } catch (chapErr) {
          // silently continue
        }
      }
    }

    // 4. Sync Published Exams
    try {
      const examsSnap = await getDocs(
        query(collection(db, 'exams'), where('isPublished', '==', true))
      );
      const exams = examsSnap.docs.map((d) => {
        const data = d.data();
        return {
          examId: data.examId || d.id,
          ...data,
        } as Exam;
      });
      if (exams.length > 0) {
        await saveDeviceExams(exams);
      }
    } catch (examErr) {
      console.warn('Sync exams skipped:', examErr);
    }

    // 5. Sync Books and Shortnotes (complete with sections and interactive content)
    try {
      const booksSnap = await getDocs(collection(db, 'books'));
      const books = booksSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Book[];
      if (books.length > 0) {
        await saveDeviceBooks(books);
      }
    } catch (bookErr) {
      console.warn('Sync books skipped:', bookErr);
    }

    updateDeviceSyncTimestamp();
    const stats = await getDeviceStorageStats();
    return { success: true, stats };
  } catch (globalErr) {
    console.warn('Background device sync encountered error:', globalErr);
    const stats = await getDeviceStorageStats();
    return { success: false, stats };
  } finally {
    isSyncInProgress = false;
  }
}
