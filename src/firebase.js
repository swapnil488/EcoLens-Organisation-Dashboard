// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Firebase Authentication
import { getFirestore } from "firebase/firestore"; // Firestore
import { getStorage } from "firebase/storage"; // Firebase Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDg4XTq8pYu37JbaHel_PJhatAqcsZsRz0",
  authDomain: "ecolens-85c94.firebaseapp.com",
  databaseURL: "https://ecolens-85c94-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ecolens-85c94",
  storageBucket: "ecolens-85c94.firebasestorage.app",
  messagingSenderId: "143678587815",
  appId: "1:143678587815:web:7feac2414b912d7be36c82",
  measurementId: "G-9PSZNDL5WR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);          // Initialize Firebase Authentication
const db = getFirestore(app);       // Initialize Firestore
const storage = getStorage(app);    // Initialize Firebase Storage

export { app, auth, db, storage };
