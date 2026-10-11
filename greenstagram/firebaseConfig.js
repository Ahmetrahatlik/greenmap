import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // <-- DEPO BURADAN GELİYOR

const firebaseConfig = {
  apiKey: "AIzaSyB4i7o2jzXMgG_WovNHP9UtTvGo-SUYZkw",
  authDomain: "greenstagram-80434.firebaseapp.com",
  projectId: "greenstagram-80434",
  storageBucket: "greenstagram-80434.firebasestorage.app",
  messagingSenderId: "844756035753",
  appId: "1:844756035753:web:176076675a74926f3fe1b8",
  measurementId: "G-BXG4FTK6XJ"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app); // <-- DEPOYU AYAĞA KALDIRDIK

export { auth, db, storage }; // <-- DIŞARIYA AÇTIK
