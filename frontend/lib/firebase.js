import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDpoLGKWAJIbxKmE5El2f4LGv7kmD2US1E",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sortifyai-2026.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sortifyai-2026",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sortifyai-2026.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "304456242479",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:304456242479:web:057ee0f5d3c2854603bdda",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-K6MPDZLWF9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

