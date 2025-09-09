// firebase.ts (MODULAR SDK + env-styrd config + mock-stöd)
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth
} from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore
} from 'firebase/firestore';

// 1) Mock-läge via ?mock=true (behåll ditt beteende)
const isMockQuery = new URLSearchParams(window.location.search).get('mock') === 'true';

// 2) Läs konfig från Vite/Netlify/ENV (ingen hårdkodning här)
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

// Små loggar så vi ser vilket projekt som används
if (import.meta.env.DEV)  console.log('FB project (DEV):',  firebaseConfig.projectId ?? '(saknas)');
if (import.meta.env.PROD) console.log('FB project (PROD):', firebaseConfig.projectId ?? '(saknas)');

// 3) Mock-auth för enkel test (som du hade)
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

// 4) Bestäm om vi kör mock
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

    // Auth-persistence (håll mig inloggad)
    setPersistence(realAuth, browserLocalPersistence)
      .then(() => console.log("Firebase Auth persistence set to 'local'."))
      .catch((error) => console.error('Firebase Auth persistence error:', error));

    // Firestore offline (single-tab). Byt till enableMultiTabIndexedDbPersistence om ni vill dela cache mellan flikar.
    enableIndexedDbPersistence(db).then(() => {
      console.log('Firestore offline persistence enabled successfully.');
    }).catch((err: any) => {
      const prefix = 'Firestore Offline Persistence Error:';
      if (err?.code === 'failed-precondition') {
        console.warn(`${prefix} flera flikar öppna – offlineläge avaktiverat.`);
      } else if (err?.code === 'unimplemented') {
        console.warn(`${prefix} webbläsaren saknar stöd – kör online-only.`);
      } else {
        console.warn(`${prefix} okänt fel:`, err);
      }
    });
  } catch (e) {
    console.error('Firebase init misslyckades:', e);
  }
}

// 5) Exporter (samma namn som du använder i appen)
export const auth = useMock ? (mockAuth as any) : (realAuth as Auth);
export { db };
export { app };
