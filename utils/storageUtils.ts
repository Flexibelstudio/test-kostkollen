import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export const uploadImageToStorage = async (
  file: File | Blob,
  path: string
): Promise<string> => {
  if (!storage) {
    throw new Error("Firebase Storage is not initialized.");
  }

  const storageRef = ref(storage, path);
  
  // Upload the file
  const snapshot = await uploadBytes(storageRef, file);
  
  // Get the download URL
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

// Helper to convert base64 to Blob
export const base64ToBlob = async (base64: string): Promise<Blob> => {
  const response = await fetch(base64);
  return response.blob();
};
