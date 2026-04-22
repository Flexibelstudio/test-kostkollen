import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export const uploadImageToStorage = async (
  file: File | Blob,
  path: string
): Promise<string> => {
  if (!storage) {
    throw new Error("Firebase Storage is not initialized.");
  }

  const storageRef = ref(storage, path);
  
  // Upload the file with explicit metadata to avoid 400 errors
  const metadata = {
    contentType: file.type || 'image/jpeg',
  };
  
  const snapshot = await uploadBytes(storageRef, file, metadata);
  
  // Get the download URL
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

// Uploads a base64 string directly using native Firebase Storage uploadString
export const uploadBase64ToStorage = async (
  base64String: string,
  path: string
): Promise<string> => {
  if (!storage) {
    throw new Error("Firebase Storage is not initialized.");
  }

  const storageRef = ref(storage, path);
  
  // uploadString with 'data_url' correctly interprets the mime type from the base64 string
  const snapshot = await uploadString(storageRef, base64String, 'data_url');
  
  return await getDownloadURL(snapshot.ref);
};

// Helper to convert base64 to Blob manually
export const base64ToBlob = async (base64: string): Promise<Blob> => {
  const parts = base64.split(';');
  const mime = parts[0].split(':')[1] || 'image/jpeg';
  const data = parts[1].split(',')[1];
  
  const byteString = atob(data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mime });
};
