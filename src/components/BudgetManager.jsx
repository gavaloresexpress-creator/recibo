import { useState, useMemo } from "react";

import { formatBRL, currentMonthKey, getInstallmentEntries } from "../utils/format";
import { maskCurrency, currencyToNumber } from "../utils/format";

function BudgetRow({ cat, budget, spent, onSave }) {
  const [editing, setEditing]   = useState(false);
  const [rawValue, setRawValue] = useState("");

  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = budget > 0 && spent > budget;
  const warn = budget > 0 && pct >= 80 && !over;

  function handleEdit() {
    setRawValue(budget > 0 ? (budget).toFixed(2).replace(".", ",") : "");
    setEditing(true);
  }

  function handleSave() {
    onSave(currencyToNumber(rawValue));
    setEditing(false);
  }

  return (
    <div className="budget-row">
      <span className="budget-row__icon">{cat.icon}</span>
      <div className="budget-row__info">
        <div className="budget-row__label">{cat.label}</div>
        <div className="budget-row__values">
          <span style={{ color: over ? "var(--rust)" : warn ? "var(--gold)" : "var(--sage)", fontWeight: 600 }}>
            {formatBRL(spent)}
          </span>
          {budget > 0 && (
            <>
              <span style={{ color: "var(--text-dim)" }}>/ {formatBRL(budget)}</span>
              <span style={{ color: "var(--text-dim)" }}>({Math.round(pct)}%)</span>
            </>
          )}
          {budget === 0 && <span style={{ color: "var(--text-dim)" }}>sem limite</span>}
        </div>
        {budget > 0 && (
          <div className="progress-wrap" style={{ marginTop: 4, height: 5 }}>
            <div
              className={`progress-bar ${over ? "progress-bar--over" : warn ? "progress-bar--warn" : "progress-bar--ok"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div className="budget-row__input">
        {editing ? (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              className="input"
              inputMode="numeric"
              value={rawValue}
              onChange={(e) => setRawValue(maskCurrency(e.target.value))}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              style={{ fontSize: 13, padding: "7px 10px" }}
              autoFocus
              placeholder="0,00"
            />
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={handleEdit}
            style={{ width: "100%", fontSize: 12, padding: "6px 10px" }}
          >
            {budget > 0 ? "Editar" : "Definir"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function BudgetManager({ budgets, setBudget, expenses, categories }) {
  const curKey = currentMonthKey();

  const spentByCategory = useMemo(() => {
    const entries = expenses
      .filter((e) => e.tipo !== "receita")
      .flatMap((e) => getInstallmentEntries(e))
      .filter((e) => e.key === curKey);
    const map = {};
    entries.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.value; });
    return map;
  }, [expenses, curKey]);

  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
  const totalSpent  = Object.values(spentByCategory).reduce((s, v) => s + (v || 0), 0);

  const expenseCategories = categories.filter(c => c.tipo !== "receita");

  return (
    <div className="tab-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {totalBudget > 0 && (
        <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
          <p className="section-title" style={{ marginBottom: 4 }}>Orçamento total do mês</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 34, fontWeight: 700, color: "var(--gold)" }}>
            {formatBRL(totalBudget)}
          </p>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            Gasto: {formatBRL(totalSpent)} · Restante: {formatBRL(Math.max(0, totalBudget - totalSpent))}
          </div>
        </div>
      )}

      <div className="card">
        <p className="section-title">Limite por categoria</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          Defina um limite mensal para cada categoria. A barra de progresso indica quanto você já gastou.
        </p>
        {expenseCategories.map((cat) => (
          <BudgetRow
            key={cat.key}
            cat={cat}
            budget={budgets[cat.key] || 0}
            spent={spentByCategory[cat.key] || 0}
            onSave={(amount) => setBudget(cat.key, amount)}
          />
        ))}
      </div>
    </div>
  );
}
