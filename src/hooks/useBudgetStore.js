import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CATEGORIES } from "../constants";

const DEFAULT_BUDGETS = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));

const budgetsDoc = (uid) => doc(db, "users", uid, "meta", "budgets");

export function useBudgetStore(userId) {
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBudgets(DEFAULT_BUDGETS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(budgetsDoc(userId), (snap) => {
      if (snap.exists()) {
        setBudgets({ ...DEFAULT_BUDGETS, ...snap.data() });
      }
      setLoading(false);
    }, (err) => {
      console.error("Budget snapshot error:", err);
      setLoading(false);
    });

    return unsub;
  }, [userId]);

  const setBudget = useCallback(async (categoryKey, amount) => {
    if (!userId) return;
    const updated = { ...budgets, [categoryKey]: Number(amount) || 0 };
    setBudgets(updated);
    try {
      await setDoc(budgetsDoc(userId), updated, { merge: true });
    } catch (err) {
      console.error("setBudget error:", err);
    }
  }, [userId, budgets]);

  return { budgets, loading, setBudget };
}
