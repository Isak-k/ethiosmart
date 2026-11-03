import { db } from "@/integrations/firebase/client";
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  where,
  Timestamp,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc
} from "firebase/firestore";
import { Department } from "@/integrations/firebase/types";
import { saveDeviceDepartments, getDeviceDepartments } from "@/lib/device-storage";

export const getDepartments = async (): Promise<Department[]> => {
  try {
    const q = query(collection(db, "departments"), orderBy("name"));
    const snapshot = await getDocs(q);
    const list = snapshot.docs
      .filter((doc) => doc.id !== '_app_config' && doc.data()?.name)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Department));

    saveDeviceDepartments(list).catch(() => {});
    return list;
  } catch (error) {
    console.warn("Error getting departments, loading from device storage:", error);
    try {
      const deviceDepts = await getDeviceDepartments();
      if (deviceDepts && deviceDepts.length > 0) return deviceDepts;
    } catch {
      // ignore
    }
    return [];
  }
};

export const createDepartment = async (name: string): Promise<string> => {
  try {
    // Check for duplicate name
    const q = query(collection(db, "departments"), where("name", "==", name));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      throw new Error("Department already exists");
    }

    const docRef = await addDoc(collection(db, "departments"), {
      name,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating department:", error);
    throw error;
  }
};

export const deleteDepartment = async (id: string) => {
  try {
    const docRef = doc(db, "departments", id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting department:", error);
    throw error;
  }
};

export const updateDepartment = async (id: string, name: string) => {
  try {
    const docRef = doc(db, "departments", id);
    await updateDoc(docRef, { name });
  } catch (error) {
    console.error("Error updating department:", error);
    throw error;
  }
};
