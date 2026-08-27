import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const budgetsDoc = (uid) => doc(db, "users", uid, "meta", "budgets");

export function useBudgetStore(userId, categories = []) {
  const defaultBudgets = useMemo(() => {
    return Object.fromEntries(categories.map((c) => [c.key, 0]));
  }, [categories]);

  const [budgets, setBudgets] = useState(defaultBudgets);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBudgets(defaultBudgets);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(budgetsDoc(userId), (snap) => {
      if (snap.exists()) {
        setBudgets({ ...defaultBudgets, ...snap.data() });
      } else {
        setBudgets(defaultBudgets);
      }
      setLoading(false);
    }, (err) => {
      console.error("Budget snapshot error:", err);
      setLoading(false);
    });

    return unsub;
  }, [userId, defaultBudgets]);

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
