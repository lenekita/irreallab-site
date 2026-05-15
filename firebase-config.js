// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";

import { getAuth }
from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDugHMiSJZBW6Yi5BelkubbHOa7j0sLfmw",
  authDomain: "irreallab-57207.firebaseapp.com",
  projectId: "irreallab-57207",
  storageBucket: "irreallab-57207.firebasestorage.app",
  messagingSenderId: "715250762800",
  appId: "1:715250762800:web:73b2d09492e4d67e5899f5",
  measurementId: "G-628Q19EM44"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
