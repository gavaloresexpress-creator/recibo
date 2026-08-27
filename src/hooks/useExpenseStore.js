import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, deleteDoc, setDoc, getDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { uid } from "../utils/format";
import { DEFAULT_CARDS } from "../constants";

// ─────────────────────────────────────────────────────────────
//  Helpers de coleção por usuário
// ─────────────────────────────────────────────────────────────
const expensesCol = (uid) => collection(db, "users", uid, "expenses");
const cardsDoc    = (uid) => doc(db, "users", uid, "meta", "cards");

export function useExpenseStore(userId) {
  const [expenses, setExpenses] = useState([]);
  const [cards,    setCards]    = useState(DEFAULT_CARDS);
  const [loading,  setLoading]  = useState(true);

  // Guarda referências aos unsubscribers para limpeza
  const unsubExpenses = useRef(null);

  // ── Observa a coleção de gastos em tempo real ──────────────
  useEffect(() => {
    if (!userId) {
      setExpenses([]);
      setCards(DEFAULT_CARDS);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Carrega cartões (documento único)
    getDoc(cardsDoc(userId)).then((snap) => {
      if (snap.exists()) setCards(snap.data().list || DEFAULT_CARDS);
    });

    // Observa gastos em tempo real
    const q = query(expensesCol(userId), orderBy("createdAt", "desc"));
    unsubExpenses.current = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      setExpenses(list);
      setLoading(false);
    }, (err) => {
      console.error("Firestore snapshot error:", err);
      setLoading(false);
    });

    return () => {
      if (unsubExpenses.current) unsubExpenses.current();
    };
  }, [userId]);

  // ── Adicionar gasto ─────────────────────────────────────────
  const addExpense = useCallback(async (expense) => {
    if (!userId) return;
    try {
      await addDoc(expensesCol(userId), {
        ...expense,
        id: uid(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("addExpense error:", err);
    }
  }, [userId]);

  // ── Deletar gasto ───────────────────────────────────────────
  const deleteExpense = useCallback(async (id) => {
    if (!userId) return;
    // Encontra o docId do Firestore pelo campo `id`
    const expense = expenses.find((e) => e.id === id);
    if (!expense?._docId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "expenses", expense._docId));
    } catch (err) {
      console.error("deleteExpense error:", err);
    }
  }, [userId, expenses]);

  // ── Adicionar cartão ─────────────────────────────────────────
  const addCard = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed || cards.includes(trimmed) || !userId) return;
    const newList = [...cards, trimmed];
    setCards(newList);
    try {
      await setDoc(cardsDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("addCard error:", err);
    }
  }, [userId, cards]);

  // ── Remover cartão ───────────────────────────────────────────
  const removeCard = useCallback(async (name) => {
    if (!userId) return;
    const newList = cards.filter((c) => c !== name);
    setCards(newList);
    try {
      await setDoc(cardsDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("removeCard error:", err);
    }
  }, [userId, cards]);

  return { expenses, cards, loading, addExpense, deleteExpense, addCard, removeCard };
}
