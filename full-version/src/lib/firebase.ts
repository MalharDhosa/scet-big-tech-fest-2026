/**
 * Firebase Configuration & Initialization
 * Project: converse2k26
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAyzvCMybtmX1U64v0dYw0XpNENxwbLcUA",
  authDomain: "converse2k26.firebaseapp.com",
  projectId: "converse2k26",
  storageBucket: "converse2k26.firebasestorage.app",
  messagingSenderId: "935887636631",
  appId: "1:935887636631:web:3116ba1454b2726142c1d2",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);
export const functions = getFunctions(app);
export default app;
