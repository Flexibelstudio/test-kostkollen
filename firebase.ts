// firebase.ts
import { initializeApp } from "@firebase/app";
// Import auth persistence functions
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from "@firebase/auth";
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from "@firebase/firestore";
import { getStorage } from "@firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "@firebase/functions";

const isMock = new URLSearchParams(window.location.search).get('mock') === 'true';

// Mock auth object for testing without a real backend.
const mockAuth = {
    currentUser: {
        uid: 'mockUser123',
        email: 'test@example.com',
        displayName: 'Mock Användare',
        metadata: {
            creationTime: new Date().toUTCString(),
            lastSignInTime: new Date().toUTCString(),
        }
    },
    onAuthStateChanged: (callback: (user: any | null) => void) => {
        console.log("Mock Auth: onAuthStateChanged triggered.");
        // Immediately call back with the mock user to simulate login.
        setTimeout(() => callback(mockAuth.currentUser), 100);
        // Return a no-op unsubscribe function.
        return () => {};
    },
    signOut: () => {
        alert("Utloggning i mock-läge. Ladda om sidan utan '?mock=true' för att logga ut på riktigt.");
        return Promise.resolve();
    },
};

const firebaseConfig = {
  apiKey: "AIzaSyBtJJhdRistJEOaaDeOosSn0RiDT39y-EY",
  authDomain: "flexibel-kostkollen.firebaseapp.com",
  projectId: "flexibel-kostkollen",
  storageBucket: "flexibel-kostkollen.appspot.com",
  messagingSenderId: "1095144779871",
  appId: "1:1095144779871:web:fa55c8bb3c2be1f7276bea"
};

// Initialize Firebase using the modular SDK
const app = initializeApp(firebaseConfig);

// Get and export the auth and firestore instances
const realAuth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app); // Get functions instance to connect to emulator

// === NEW CODE TO CONNECT TO EMULATORS IN DEV MODE ===
// This block must be placed AFTER initializing the services but BEFORE they are used.
if (window.location.hostname === "localhost") {
  console.log("DEV MODE: Connecting to Firebase Emulators");
  connectAuthEmulator(realAuth, "http://localhost:9199");
  connectFirestoreEmulator(db, "localhost", 8181);
  connectFunctionsEmulator(functions, "localhost", 5001);
}
// =====================================================

export const auth = isMock ? mockAuth as any : realAuth;


// Set persistence for the AUTH instance right away. This is a one-time setup.
export const authPersistencePromise = isMock
  ? Promise.resolve({ success: true, message: "Kör i mock-läge, inloggning sparas." })
  : setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Firebase Auth persistence set to 'local'.");
        return { success: true, message: null };
      })
      .catch((error) => {
        console.error("Firebase Auth persistence error:", error);
        return { success: false, message: "Kunde inte aktivera 'håll mig inloggad'-funktionen. Du kan bli utloggad när du stänger appen." };
      });


// Export a promise that resolves with the FIRESTORE persistence status.
export const firestorePersistencePromise = isMock
  ? Promise.resolve({ success: true, message: "Kör i mock-läge. Data sparas lokalt i webbläsaren." })
  : enableIndexedDbPersistence(db)
  .then(() => {
    console.log("Firestore offline persistence enabled successfully.");
    return { success: true, message: null };
  })
  .catch((err) => {
    const errorPrefix = "Firestore Offline Persistence Error:";
    let message = "Ett oväntat fel hindrade offlineläge från att aktiveras. Appen kommer att kräva internetanslutning.";
    
    if (err.code === 'failed-precondition') {
      message = "Offlineläge kunde inte aktiveras eftersom appen är öppen i flera flikar. Stäng de andra flikarna och ladda om för att använda appen offline.";
    } else if (err.code === 'unimplemented') {
      message = "Din webbläsare stödjer inte offlineläge. Appen kommer att kräva en internetanslutning.";
    }
    
    console.error(`${errorPrefix} ${message}`, err);
    return { success: false, message: message };
  });