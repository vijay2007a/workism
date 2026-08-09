import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, GithubAuthProvider, GoogleAuthProvider, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseVars = [
  ["apiKey", "VITE_FIREBASE_API_KEY"],
  ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "VITE_FIREBASE_PROJECT_ID"],
  ["storageBucket", "VITE_FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ["appId", "VITE_FIREBASE_APP_ID"],
] as const;

export const firebaseConfigured = missingFirebaseVars.every(([key]) => Boolean(firebaseConfig[key]));

export function firebaseConfigurationMessage() {
  const missing = missingFirebaseVars.filter(([key]) => !firebaseConfig[key]).map(([, envName]) => envName);
  return missing.length
    ? `Missing Firebase environment variable(s): ${missing.join(", ")}`
    : "Firebase is not configured.";
}

export const firebaseApp = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
if (auth) {
  void setPersistence(auth, browserLocalPersistence);
}
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const googleProvider = firebaseApp ? new GoogleAuthProvider() : null;
export const githubProvider = firebaseApp ? new GithubAuthProvider() : null;
