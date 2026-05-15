// firebase-config.js
// Secure Firebase configuration using environment variables

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Load configuration from environment variables (never hardcode!)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "irreallab-57207.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "irreallab-57207",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "irreallab-57207.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "715250762800",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:715250762800:web:b8d8652b1b4a61835899f5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-D2NW82VGBV"
};

// Verify API key is loaded
if (!firebaseConfig.apiKey) {
  console.error("❌ Firebase API key not found! Make sure .env.local exists with VITE_FIREBASE_API_KEY");
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
