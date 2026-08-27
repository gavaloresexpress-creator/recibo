import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export function useAuth() {
  const [user, setUser]       = useState(undefined); // undefined = ainda carregando
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Observa mudanças no estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u); // null = deslogado, objeto = logado
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        setAuthError("Não foi possível fazer login. Tente novamente.");
        console.error("Auth error:", error);
      }
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("SignOut error:", error);
    }
  }

  return {
    user,                            // null | FirebaseUser
    loading: user === undefined,     // true enquanto verifica sessão
    signInWithGoogle,
    signOut,
    authError,
  };
}
