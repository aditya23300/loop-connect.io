// this is the client side firebase config so it can be revealed
//Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
const firebaseConfig = {
  apiKey: "AIzaSyD55FYWJi-PaQhhVOYNae4wV2WudbJDC54",
  authDomain: "loopconnect-33994.firebaseapp.com",
  projectId: "loopconnect-33994",
  storageBucket: "loopconnect-33994.firebasestorage.app",
  messagingSenderId: "630605289468",
  appId: "1:630605289468:web:4c11602c0cdb9a03f64479",
  measurementId: "G-PBPP6XH8F3",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
auth.languageCode = "en";
// Exporting these as named exports
export { provider, auth, getAuth, signInWithPopup, GoogleAuthProvider };
