import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
//  CONFIGURAÇÃO DO FIREBASE
//  Preencha o arquivo .env com os valores do seu projeto Firebase.
//  Acesse: console.firebase.google.com → Configurações → Seus apps
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Verifica se as credenciais foram configuradas
const isConfigured = Object.values(firebaseConfig).every(
  (v) => v && !v.includes("COLE_AQUI")
);

export { isConfigured };

const app  = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Solicita a seleção de conta mesmo que o usuário já esteja logado
googleProvider.setCustomParameters({ prompt: "select_account" });
