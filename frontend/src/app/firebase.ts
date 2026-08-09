import { initializeApp } from "firebase/app";
import { getAuth, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCCYdd-N6Zt6oBsPF3z2wXJSah3H2TZcJo",
  authDomain: "workism-6021d.firebaseapp.com",
  projectId: "workism-6021d",
  storageBucket: "workism-6021d.firebasestorage.app",
  messagingSenderId: "197511736592",
  appId: "1:197511736592:web:e133450e177b808430c995",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const githubProvider = new GithubAuthProvider();
