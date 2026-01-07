// =========================================================
// 🔧 CONFIGURATION - Edit this file to change settings
// =========================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDTzKyF9ADgclb89V2Kl1rPz4oSEKsFnoc",
  authDomain: "sigma-hq-38843.firebaseapp.com",
  projectId: "sigma-hq-38843",
  storageBucket: "sigma-hq-38843.firebasestorage.app",
  messagingSenderId: "387932394342",
  appId: "1:387932394342:web:d098bddc335659ac686ea7",
  measurementId: "G-369PLRWC4H"
};

export const APP_ID = 'sigma-hq-production';

export const SYNC_WORKER_URL = "https://sigma-sync-worker-71025980302.europe-west1.run.app";

export const COLORS = {
  navy: '#0A1628',      // Deeper Sigma blue for sidebar
  blue: '#00A8E8',      // Accent blue
  gold: '#F7941D',      // Warning/sync color
  background: '#F1F5F9',
  white: '#FFFFFF'
};

export const BRANDING = {
  logo: "https://raw.githubusercontent.com/Mousa-alt/Sigma-logo-PORTRAIT/main/Sigma%20landscape.png",
  logoWhite: "https://raw.githubusercontent.com/Mousa-alt/Sigma-logo-PORTRAIT/main/Sigma%20-%20Logo-LS-white.png",
  title: "Technical Office HQ",
  subtitle: "Command Center",
};

export const LOCATIONS = ['Cairo', 'Riyadh', 'Dubai'];

export const SUBMISSION_CATEGORIES = [
  { value: 'shop_drawing', label: 'Shop Drawing' },
  { value: 'material', label: 'Material Submittal' },
  { value: 'rfi', label: 'RFI' },
  { value: 'variation', label: 'Variation Order' },
  { value: 'inspection', label: 'Inspection Request' }
];

export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'vault', label: 'Project Documents', icon: 'folder-open' },
  { id: 'actions', label: 'Actions', icon: 'zap' },
];
