// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBKzbJDwaDxSZtoe4IpvT3TRtFXjZgB_NQ",
  authDomain: "landing-page-builder-66295.firebaseapp.com",
  projectId: "landing-page-builder-66295",
  storageBucket: "landing-page-builder-66295.firebasestorage.app",
  messagingSenderId: "941959864294",
  appId: "1:941959864294:web:870d16c9c3059ea24c0027",
};

const app = initializeApp(firebaseConfig);

// ✅ THIS LINE WAS MISSING — exports db so auth.ts can import it
export const db = getFirestore(app);
export const storage = getStorage(app);
