// firestore-service.js - FIXED
// Database operations for reels collection

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const reelsCollection = collection(db, "reels");

// Get all reels sorted by order
export async function getAllReels() {
  try {
    const q = query(reelsCollection, orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    const reels = [];
    snapshot.forEach((doc) => {
      reels.push({ id: doc.id, ...doc.data() });
    });
    return reels;
  } catch (error) {
    console.error("Error getting reels:", error);
    throw error;
  }
}

// Listen for real-time updates
export function listenToReels(callback) {
  const q = query(reelsCollection, orderBy("order", "asc"));
  return onSnapshot(q, (snapshot) => {
    const reels = [];
    snapshot.forEach((doc) => {
      reels.push({ id: doc.id, ...doc.data() });
    });
    callback(reels);
  });
}

// Add new reel
export async function addReel(reelData) {
  try {
    // Get highest order number
    const reels = await getAllReels();
    const maxOrder = reels.length > 0 ? Math.max(...reels.map(r => r.order || 0)) : 0;

    const newReel = {
      ...reelData,
      order: maxOrder + 1,
      createdAt: Timestamp.now(),
      video_url: reelData.video_url || "",
      thumbnail_url: reelData.thumbnail_url || ""
    };

    const docRef = await addDoc(reelsCollection, newReel);
    return { id: docRef.id, ...newReel };
  } catch (error) {
    console.error("Error adding reel:", error);
    throw error;
  }
}

// Update existing reel
export async function updateReel(docId, reelData) {
  try {
    const reelRef = doc(db, "reels", docId);
    await updateDoc(reelRef, {
      ...reelData,
      updatedAt: Timestamp.now()
    });
    return { id: docId, ...reelData };
  } catch (error) {
    console.error("Error updating reel:", error);
    throw error;
  }
}

// Delete reel
export async function deleteReel(docId) {
  try {
    await deleteDoc(doc(db, "reels", docId));
    return true;
  } catch (error) {
    console.error("Error deleting reel:", error);
    throw error;
  }
}

// Update reel order
export async function updateReelOrder(docId, newOrder) {
  try {
    const reelRef = doc(db, "reels", docId);
    await updateDoc(reelRef, { order: newOrder });
    return true;
  } catch (error) {
    console.error("Error updating reel order:", error);
    throw error;
  }
}

// Get single reel by ID - FIXED VERSION
export async function getReel(docId) {
  try {
    const reelRef = doc(db, "reels", docId);
    const snapshot = await getDoc(reelRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error("Error getting reel:", error);
    throw error;
  }
}
