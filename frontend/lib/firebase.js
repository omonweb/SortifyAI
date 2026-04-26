import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDpoLGKWAJIbxKmE5El2f4LGv7kmD2US1E",
  authDomain: "sortifyai-2026.firebaseapp.com",
  projectId: "sortifyai-2026",
  storageBucket: "sortifyai-2026.firebasestorage.app",
  messagingSenderId: "304456242479",
  appId: "1:304456242479:web:057ee0f5d3c2854603bdda",
  measurementId: "G-K6MPDZLWF9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

