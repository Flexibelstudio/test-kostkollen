
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "@firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from "@firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// ?mock=true aktiverar mock-läge (praktiskt för lokal test)
const isMockQuery =
  new URLSearchParams(window.location.search).get("mock") === "true";

// Läs Firebase-konfig från Vite/Netlify (OBS: import.meta.env i Vite)
export const firebaseConfig = {
// FIX: Cast `import.meta` to `any` to resolve TypeScript errors when Vite client types are not available.
  apiKey: (import.meta as any).env.VITE_FB_API_KEY,
  authDomain: (import.meta as any).env.VITE_FB_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FB_PROJECT_ID,
  // Sanitize the storage bucket just in case it was pasted with gs:// or a trailing slash in prod
  storageBucket: ((import.meta as any).env.VITE_FB_STORAGE_BUCKET || "").replace(/^gs:\/\//, "").replace(/\/$/, ""),
  messagingSenderId: (import.meta as any).env.VITE_FB_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FB_APP_ID,
  ...((import.meta as any).env.VITE_FB_MEASUREMENT_ID
    ? { measurementId: (import.meta as any).env.VITE_FB_MEASUREMENT_ID }
    : {}),
} as const;

// FIX: Cast `import.meta` to `any` to resolve TypeScript errors.
if ((import.meta as any).env.DEV)
  console.log("FB project (DEV):", firebaseConfig.projectId ?? "(saknas)");
// FIX: Cast `import.meta` to `any` to resolve TypeScript errors.
if ((import.meta as any).env.PROD)
  console.log("FB project (PROD):", firebaseConfig.projectId ?? "(saknas)");

// Enkel mock-auth när config saknas eller ?mock=true
const mockAuth = {
  currentUser: {
    uid: "mockUser123",
    email: "test@example.com",
    displayName: "Mock Användare",
    metadata: {
      creationTime: new Date().toUTCString(),
      lastSignInTime: new Date().toUTCString(),
    },
  },
  onAuthStateChanged: (cb: (user: any | null) => void) => {
    console.log("Mock Auth: onAuthStateChanged");
    setTimeout(() => cb((mockAuth as any).currentUser), 100);
    return () => {};
  },
  signOut: () => {
    alert(
      "Utloggning i mock-läge. Ladda om sidan utan '?mock=true' för att logga ut på riktigt."
    );
    return Promise.resolve();
  },
} as any;

// Om någon env saknas → kör mock/offline
const hasValidConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);
const useMock = isMockQuery || !hasValidConfig;

let app: FirebaseApp | undefined;
let realAuth: Auth | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;
let storage: FirebaseStorage | undefined;

if (useMock) {
  console.warn(
    hasValidConfig
      ? "Mock-läge aktiverat via ?mock=true."
      : "Firebase config saknas → mock/offline-läge."
  );
} else {
  try {
    app = initializeApp(firebaseConfig);
    realAuth = getAuth(app);
    db = getFirestore(app); // Prod & staging = separata projekt via netlify.toml
    functions = getFunctions(app, 'us-central1'); // Init functions in same region as backend
    storage = getStorage(app);
  } catch (e) {
    console.error("Firebase init misslyckades:", e);
  }
}

// ===== Exporterade instanser =====
export const auth = useMock ? (mockAuth as any) : (realAuth as Auth);
export { db, app, functions, storage };

// ===== Promises för persistence (används i App.tsx) =====
export const authPersistencePromise: Promise<{
  success: boolean;
  message: string | null;
}> = useMock
  ? Promise.resolve({
      success: true,
      message: "Kör i mock-läge, inloggning sparas.",
    })
  : realAuth
  ? setPersistence(realAuth, browserLocalPersistence)
      .then(() => {
        console.log("Firebase Auth persistence set to 'local'.");
        return { success: true, message: null };
      })
      .catch((error) => {
        console.error("Firebase Auth persistence error:", error);
        return {
          success: false,
          message:
            "Kunde inte aktivera 'håll mig inloggad'. Du kan bli utloggad när du stänger appen.",
        };
      })
  : Promise.resolve({
      success: false,
      message: "Auth ej initierad (saknar Firebase-konfiguration).",
    });

export const firestorePersistencePromise: Promise<{
  success: boolean;
  message: string | null;
}> = useMock
  ? Promise.resolve({
      success: true,
      message: "Kör i mock-läge. Data sparas lokalt i webbläsaren.",
    })
  : db
  ? enableIndexedDbPersistence(db)
      .then(() => {
        console.log("Firestore offline persistence enabled successfully.");
        return { success: true, message: null };
      })
      .catch((err: any) => {
        let message =
          "Ett oväntat fel hindrade offlineläge från att aktiveras. Appen kräver internetanslutning.";
        if (err?.code === "failed-precondition") {
          message =
            "Offlineläge kunde inte aktiveras eftersom appen är öppen i flera flikar. Stäng andra flikar och ladda om.";
        } else if (err?.code === "unimplemented") {
          message =
            "Din webbläsare stödjer inte offlineläge. Appen kräver internetanslutning.";
        }
        console.error("Firestore Offline Persistence Error:", err);
        return { success: false, message };
      })
  : Promise.resolve({
      success: false,
      message: "Firestore ej initierad (saknar Firebase-konfiguration).",
    });
