import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, deleteDoc, setDoc, getDoc, updateDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { uid } from "../utils/format";
import { DEFAULT_CARDS, DEFAULT_CATEGORIES } from "../constants";

// ─────────────────────────────────────────────────────────────
//  Helpers de coleção por usuário
// ─────────────────────────────────────────────────────────────
const expensesCol = (uid) => collection(db, "users", uid, "expenses");
const billsCol    = (uid) => collection(db, "users", uid, "bills");
const cardsDoc    = (uid) => doc(db, "users", uid, "meta", "cards");
const categoriesDoc = (uid) => doc(db, "users", uid, "meta", "categories");
const splitterDoc   = (uid) => doc(db, "users", uid, "meta", "splitter");

const DEFAULT_SPLITTER = [
  { id: "1", label: "Gastos Essenciais", percent: 50, color: "#5B8DEF" },
  { id: "2", label: "Estilo de Vida", percent: 30, color: "#E6B44A" },
  { id: "3", label: "Investimentos", percent: 20, color: "#3DD68C" },
];

export function useExpenseStore(userId) {
  const [expenses, setExpenses] = useState([]);
  const [bills,    setBills]    = useState([]);
  const [cards,    setCards]    = useState(DEFAULT_CARDS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [splitterEnvelopes, setSplitterEnvelopes] = useState(DEFAULT_SPLITTER);
  const [loading,  setLoading]  = useState(true);

  // Guarda referências aos unsubscribers para limpeza
  const unsubExpenses = useRef(null);
  const unsubBills    = useRef(null);

  // ── Observa a coleção de gastos em tempo real ──────────────
  useEffect(() => {
    if (!userId) {
      setExpenses([]);
      setCards(DEFAULT_CARDS);
      setCategories(DEFAULT_CATEGORIES);
      setSplitterEnvelopes(DEFAULT_SPLITTER);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Carrega cartões (documento único)
    getDoc(cardsDoc(userId)).then((snap) => {
      if (snap.exists()) {
        const userCards = snap.data().list || DEFAULT_CARDS;
        // Migra cartões antigos (strings) para objetos
        const migrated = userCards.map(c => 
          typeof c === "string" 
            ? { id: c, name: c, fechamento: 25, vencimento: 1 } 
            : c
        );
        setCards(migrated);
      } else {
        setCards(DEFAULT_CARDS);
      }
    });

    // Carrega categorias (documento único)
    getDoc(categoriesDoc(userId)).then((snap) => {
      if (snap.exists()) {
        const userCats = snap.data().list || [];
        // Mescla defaults ausentes para garantir que novas categorias (ex: receitas) apareçam
        const merged = [...userCats];
        DEFAULT_CATEGORIES.forEach(dc => {
          if (!merged.find(c => c.key === dc.key)) merged.push(dc);
        });
        // Garante que as antigas tenham tipo="despesa" se não tiver tipo
        merged.forEach(c => { if (!c.tipo) c.tipo = "despesa"; });
        setCategories(merged);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    });

    // Carrega envelopes do splitter (documento único)
    getDoc(splitterDoc(userId)).then((snap) => {
      if (snap.exists()) {
        setSplitterEnvelopes(snap.data().list || DEFAULT_SPLITTER);
      } else {
        setSplitterEnvelopes(DEFAULT_SPLITTER);
      }
    });

    // Observa gastos em tempo real
    const q = query(expensesCol(userId), orderBy("createdAt", "desc"));
    unsubExpenses.current = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      setExpenses(list);
      setLoading(false);
    }, (err) => {
      console.error("Firestore snapshot error (expenses):", err);
      setLoading(false);
    });

    // Observa bills em tempo real
    const qBills = query(billsCol(userId), orderBy("createdAt", "desc"));
    unsubBills.current = onSnapshot(qBills, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      setBills(list);
    }, (err) => {
      console.error("Firestore snapshot error (bills):", err);
    });

    return () => {
      if (unsubExpenses.current) unsubExpenses.current();
      if (unsubBills.current) unsubBills.current();
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

  // ── Editar gasto ────────────────────────────────────────────
  const updateExpense = useCallback(async (id, newData) => {
    if (!userId) return;
    const expense = expenses.find((e) => e.id === id);
    if (!expense?._docId) return;
    try {
      await updateDoc(doc(db, "users", userId, "expenses", expense._docId), newData);
    } catch (err) {
      console.error("updateExpense error:", err);
    }
  }, [userId, expenses]);

  // ── Adicionar cartão ─────────────────────────────────────────
  const addCard = useCallback(async (cardObj) => {
    if (!userId || !cardObj || cards.find(c => c.id === cardObj.id)) return;
    const newList = [...cards, cardObj];
    setCards(newList);
    try {
      await setDoc(cardsDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("addCard error:", err);
    }
  }, [userId, cards]);

  // ── Remover cartão ───────────────────────────────────────────
  const removeCard = useCallback(async (id) => {
    if (!userId) return;
    const newList = cards.filter((c) => c.id !== id);
    setCards(newList);
    try {
      await setDoc(cardsDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("removeCard error:", err);
    }
  }, [userId, cards]);

  // ── Atualizar cartão ─────────────────────────────────────────
  const updateCard = useCallback(async (id, newData) => {
    if (!userId) return;
    const newList = cards.map((c) => (c.id === id ? { ...c, ...newData } : c));
    setCards(newList);
    try {
      await setDoc(cardsDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("updateCard error:", err);
    }
  }, [userId, cards]);

  // ── Adicionar Categoria ────────────────────────────────────────
  const addCategory = useCallback(async (catObj) => {
    if (!userId) return;
    const newList = [...categories, catObj];
    setCategories(newList);
    try {
      await setDoc(categoriesDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("addCategory error:", err);
    }
  }, [userId, categories]);

  // ── Remover Categoria ──────────────────────────────────────────
  const deleteCategory = useCallback(async (key) => {
    if (!userId) return;
    const newList = categories.filter((c) => c.key !== key);
    setCategories(newList);
    try {
      await setDoc(categoriesDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("deleteCategory error:", err);
    }
  }, [userId, categories]);

  // ── Atualizar Categoria ──────────────────────────────────────────
  const updateCategory = useCallback(async (key, newData) => {
    if (!userId) return;
    const newList = categories.map((c) => (c.key === key ? { ...c, ...newData } : c));
    setCategories(newList);
    try {
      await setDoc(categoriesDoc(userId), { list: newList }, { merge: true });
    } catch (err) {
      console.error("updateCategory error:", err);
    }
  }, [userId, categories]);

  // ── Atualizar Splitter ──────────────────────────────────────────
  const updateSplitterEnvelopes = useCallback(async (newEnvelopes) => {
    if (!userId) return;
    setSplitterEnvelopes(newEnvelopes);
    try {
      await setDoc(splitterDoc(userId), { list: newEnvelopes }, { merge: true });
    } catch (err) {
      console.error("updateSplitter error:", err);
    }
  }, [userId]);

  // ── Adicionar Conta (Bill) ──────────────────────────────────
  const addBill = useCallback(async (bill) => {
    if (!userId) return;
    try {
      await addDoc(billsCol(userId), {
        ...bill,
        id: uid(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("addBill error:", err);
    }
  }, [userId]);

  // ── Deletar Conta (Bill) ────────────────────────────────────
  const deleteBill = useCallback(async (id) => {
    if (!userId) return;
    const bill = bills.find((b) => b.id === id);
    if (!bill?._docId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "bills", bill._docId));
    } catch (err) {
      console.error("deleteBill error:", err);
    }
  }, [userId, bills]);

  // ── Atualizar Conta (Bill) ──────────────────────────────────
  const updateBill = useCallback(async (id, newData) => {
    if (!userId) return;
    const bill = bills.find((b) => b.id === id);
    if (!bill?._docId) return;
    try {
      await updateDoc(doc(db, "users", userId, "bills", bill._docId), newData);
    } catch (err) {
      console.error("updateBill error:", err);
    }
  }, [userId, bills]);

  return { expenses, cards, categories, splitterEnvelopes, bills, loading, addExpense, deleteExpense, updateExpense, addCard, removeCard, updateCard, addCategory, updateCategory, deleteCategory, updateSplitterEnvelopes, addBill, deleteBill, updateBill };
}
