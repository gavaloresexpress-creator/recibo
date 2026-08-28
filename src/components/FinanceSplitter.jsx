import { useState, useEffect } from "react";
import { Plus, Trash2, Calculator, Wallet, PieChart } from "lucide-react";
import { formatBRL, currencyToNumber, maskCurrency } from "../utils/format";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_ENVELOPES = [
  { id: "e1", name: "Gastos Essenciais", percent: 50, color: "#5B8DEF" },
  { id: "e2", name: "Estilo de Vida", percent: 30, color: "#E6B44A" },
  { id: "e3", name: "Investimentos", percent: 20, color: "#3DD68C" },
];

export default function FinanceSplitter({ envelopes = [], onUpdateEnvelopes }) {
  const [amountMasked, setAmountMasked] = useState("0,00");

  const totalAmount = currencyToNumber(amountMasked) || 0;
  const totalPercent = envelopes.reduce((s, e) => s + (Number(e.percent) || 0), 0);
  const remainingPercent = 100 - totalPercent;

  function handleAdd() {
    const newId = "e" + Date.now();
    onUpdateEnvelopes([...envelopes, { id: newId, name: "Nova Categoria", percent: 0, color: "#7A8AAD" }]);
  }

  function handleRemove(id) {
    onUpdateEnvelopes(envelopes.filter(e => e.id !== id));
  }

  function handleUpdate(id, field, value) {
    onUpdateEnvelopes(envelopes.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  return (
    <div className="tab-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      <div className="card" style={{ background: "linear-gradient(135deg, rgba(61, 214, 140, 0.08) 0%, var(--bg-card) 100%)", border: "1px solid rgba(61, 214, 140, 0.2)" }}>
        <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--sage)" }}>
          <Wallet size={16} /> Receita a Distribuir
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.4 }}>
          Digite o valor que você recebeu. A calculadora vai dividir esse montante nas suas categorias automaticamente.
        </p>
        
        <div className="field" style={{ marginBottom: 0 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 14, color: "var(--text-dim)", fontWeight: 600 }}>R$</span>
            <input
              className="input input--success"
              style={{ fontSize: 24, padding: "12px 12px 12px 42px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}
              inputMode="numeric"
              placeholder="0,00"
              value={amountMasked}
              onChange={(e) => setAmountMasked(maskCurrency(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>Distribuição (%)</p>
          <span style={{ fontSize: 12, fontWeight: 600, color: totalPercent === 100 ? "var(--sage)" : (totalPercent > 100 ? "var(--rust)" : "var(--gold)") }}>
            {totalPercent}% alocado
          </span>
        </div>

        {totalPercent > 100 && (
          <div style={{ padding: "8px 12px", background: "rgba(230,82,82,0.1)", color: "var(--rust)", fontSize: 12, borderRadius: 6, marginBottom: 16 }}>
            Atenção! Você distribuiu mais de 100% da sua receita.
          </div>
        )}
        
        {totalPercent < 100 && totalPercent > 0 && (
          <div style={{ padding: "8px 12px", background: "rgba(230,180,74,0.1)", color: "var(--gold)", fontSize: 12, borderRadius: 6, marginBottom: 16 }}>
            Ainda restam {remainingPercent.toFixed(1)}% ({formatBRL(totalAmount * (remainingPercent / 100))}) para distribuir.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AnimatePresence>
            {envelopes.map((env) => {
              const allocatedAmount = totalAmount * ((Number(env.percent) || 0) / 100);
              
              return (
                <motion.div
                  key={env.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
                      <input
                        type="color"
                        value={env.color}
                        onChange={(e) => handleUpdate(env.id, "color", e.target.value)}
                        style={{ width: "100%", height: "100%", padding: 0, border: "none", borderRadius: 8, cursor: "pointer", background: "none" }}
                      />
                    </div>
                    <input
                      className="input"
                      value={env.name}
                      onChange={(e) => handleUpdate(env.id, "name", e.target.value)}
                      placeholder="Nome da categoria"
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", position: "relative", width: 80 }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        value={env.percent}
                        onChange={(e) => handleUpdate(env.id, "percent", e.target.value)}
                        style={{ paddingRight: 24, fontSize: 13, width: "100%" }}
                      />
                      <span style={{ position: "absolute", right: 10, color: "var(--text-dim)", fontSize: 13, pointerEvents: "none" }}>%</span>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => handleRemove(env.id)}
                      style={{ color: "var(--rust)" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  {/* Progress bar and amount */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 52 }}>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, env.percent)}%`, background: env.color, borderRadius: 3, transition: "width 0.3s ease" }} />
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: "var(--text)", minWidth: 80, textAlign: "right" }}>
                      {formatBRL(allocatedAmount)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ width: "100%", marginTop: 16, display: "flex", justifyContent: "center", gap: 6, padding: "10px" }}
          onClick={handleAdd}
        >
          <Plus size={16} /> Adicionar Categoria
        </button>
      </div>
      
    </div>
  );
}
