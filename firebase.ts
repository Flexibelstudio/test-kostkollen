// firebase.ts — MODULAR SDK + ENV + MOCK + exporterade *Promise*:ar
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';

// ?mock=true aktiverar mock-läge
const isMockQuery = new URLSearchParams(window.location.search).get('mock') === 'true';

// Läs Firebase-konfig från Vite/Netlify-miljövariabler
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FB_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FB_APP_ID as string | undefined,
  ...(import.meta.env.VITE_FB_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID as string }
    : {}),
} as const;

if (import.meta.env.DEV)  console.log('FB project (DEV):',  firebaseConfig.projectId ?? '(saknas)');
if (import.meta.env.PROD) console.log('FB project (PROD):', firebaseConfig.projectId ?? '(saknas)');

// Mock-auth (samma som tidigare)
const mockAuth = {
  currentUser: {
    uid: 'mockUser123',
    email: 'test@example.com',
    displayName: 'Mock Användare',
    metadata: {
      creationTime: new Date().toUTCString(),
      lastSignInTime: new Date().toUTCString(),
    },
  },
  onAuthStateChanged: (cb: (user: any | null) => void) => {
    console.log('Mock Auth: onAuthStateChanged triggered.');
    setTimeout(() => cb(mockAuth.currentUser), 100);
    return () => {};
  },
  signOut: () => {
    alert("Utloggning i mock-läge. Ladda om sidan utan '?mock=true' för att logga ut på riktigt.");
    return Promise.resolve();
  },
} as any;

const hasValidConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const useMock = isMockQuery || !hasValidConfig;

let app: FirebaseApp | undefined;
let realAuth: Auth | undefined;
let db: Firestore | undefined;

if (useMock) {
  console.warn(
    hasValidConfig
      ? 'Mock-läge aktiverat via ?mock=true.'
      : 'Firebase config saknas → kör i mock/offline-läge.'
  );
} else {
  try {
    app = initializeApp(firebaseConfig);
    realAuth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error('Firebase init misslyckades:', e);
  }
}

// ===== Exporterade instanser =====
export const auth = useMock ? (mockAuth as any) : (realAuth as Auth);
export { db, app };

// ===== Exporterade Promise:ar (behövs av App.tsx) =====
export const authPersistencePromise: Promise<{ success: boolean; message: string | null }> =
  useMock
    ? Promise.resolve({ success: true, message: 'Kör i mock-läge, inloggning sparas.' })
    : realAuth
      ? setPersistence(realAuth, browserLocalPersistence)
          .then(() => {
            console.log("Firebase Auth persistence set to 'local'.");
            return { success: true, message: null };
          })
          .catch((error) => {
            console.error('Firebase Auth persistence error:', error);
            return {
              success: false,
              message:
                "Kunde inte aktivera 'håll mig inloggad'-funktionen. Du kan bli utloggad när du stänger appen.",
            };
          })
      : Promise.resolve({
          success: false,
          message: 'Auth ej initierad (saknar Firebase-konfiguration).',
        });

export const firestorePersistencePromise: Promise<{ success: boolean; message: string | null }> =
  useMock
    ? Promise.resolve({
        success: true,
        message: 'Kör i mock-läge. Data sparas lokalt i webbläsaren.',
      })
    : db
      ? enableIndexedDbPersistence(db)
          .then(() => {
            console.log('Firestore offline persistence enabled successfully.');
            return { success: true, message: null };
          })
          .catch((err: any) => {
            const errorPrefix = 'Firestore Offline Persistence Error:';
            let message =
              'Ett oväntat fel hindrade offlineläge från att aktiveras. Appen kommer att kräva internetanslutning.';

            if (err?.code === 'failed-precondition') {
              message =
                'Offlineläge kunde inte aktiveras eftersom appen är öppen i flera flikar. Stäng andra flikar och ladda om.';
            } else if (err?.code === 'unimplemented') {
              message =
                'Din webbläsare stödjer inte offlineläge. Appen kommer att kräva en internetanslutning.';
            }
            console.error(`${errorPrefix} ${message}`, err);
            return { success: false, message };
          })
      : Promise.resolve({
          success: false,
          message: 'Firestore ej initierad (saknar Firebase-konfiguration).',
        });
