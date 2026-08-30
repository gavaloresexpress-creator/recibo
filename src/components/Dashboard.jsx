import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, ReferenceLine,
} from "recharts";
import { Wallet, TrendingUp, TrendingDown, CreditCard, Calendar, Lightbulb, Target } from "lucide-react";
import { motion } from "framer-motion";

import {
  formatBRL, currentMonthKey, monthLabel, shiftMonthKey, getInstallmentEntries, todayISO,
} from "../utils/format";
import { PAYMENT_METHODS } from "../constants";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip__label">{label}</div>}
      <div className="chart-tooltip__value">{formatBRL(payload[0].value)}</div>
      {payload[1] && payload[1].value > 0 && (
        <div style={{ fontSize: 11, color: "#7A8AAD", marginTop: 2 }}>
          Projeção: {formatBRL(payload[1].value)}
        </div>
      )}
    </div>
  );
}

// Primeiro dia do mês atual em formato ISO
function firstOfCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Dashboard({ expenses, categories, cards = [], budgets = {} }) {
  const curKey = currentMonthKey();
  const today = todayISO();

  // --- Estado do seletor de período ---
  const [rangeStart, setRangeStart] = useState(firstOfCurrentMonth());
  const [rangeEnd,   setRangeEnd]   = useState(today);

  const catByKey = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c])),
    [categories]
  );

  const allEntries = useMemo(
    () => expenses.flatMap((e) => getInstallmentEntries(e, cards)),
    [expenses, cards]
  );

  // ── KPI: total do período ──
  // Filtra compras pela DATA DE COMPRA dentro do período.
  // Para parceladas: conta apenas o valor de 1 parcela (não o total da compra).
  const rangeStats = useMemo(() => {
    if (!rangeStart || !rangeEnd) return { totalDespesas: 0, totalReceitas: 0, saldo: 0, avista: 0, parcelado: 0, numParceladas: 0, numCompras: 0 };

    let avista = 0, parcelado = 0, numParceladas = 0, totalReceitas = 0;

    const inRange = expenses.filter((e) => e.data >= rangeStart && e.data <= rangeEnd);

    inRange.forEach((exp) => {
      const isIncome = exp.tipo === "receita";
      const parcelas = Math.max(1, Number(exp.parcelas) || 1);
      
      if (isIncome) {
        totalReceitas += exp.valor;
      } else {
        if (parcelas > 1) {
          parcelado    += exp.valor / parcelas; // só a parcela deste período
          numParceladas += 1;
        } else {
          avista += exp.valor;
        }
      }
    });

    const totalDespesas = avista + parcelado;
    return {
      totalDespesas,
      totalReceitas,
      saldo: totalReceitas - totalDespesas,
      avista,
      parcelado,
      numParceladas,
      numCompras: inRange.filter(e => e.tipo !== "receita").length,
    };
  }, [expenses, rangeStart, rangeEnd]);


  const { totalDespesas, totalReceitas, saldo: rangeSaldo, avista: rangeAvista, parcelado: rangeParcelado,
          numParceladas: rangeNumParcelas, numCompras: rangeNumCompras } = rangeStats;

  // Comparativo: mesmo intervalo de meses no período anterior
  const rangeDays = useMemo(() => {
    if (!rangeStart || !rangeEnd) return 0;
    return Math.round((new Date(rangeEnd) - new Date(rangeStart)) / 86400000);
  }, [rangeStart, rangeEnd]);

  const prevRangeStart = useMemo(() => {
    if (!rangeStart) return null;
    const d = new Date(rangeStart);
    d.setDate(d.getDate() - (rangeDays + 1));
    return d.toISOString().slice(0, 10);
  }, [rangeStart, rangeDays]);

  const prevRangeEnd = useMemo(() => {
    if (!rangeStart) return null;
    const d = new Date(rangeStart);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [rangeStart]);

  const totalPrevRangeDespesas = useMemo(() => {
    if (!prevRangeStart || !prevRangeEnd) return 0;
    const startKey = prevRangeStart.slice(0, 7);
    const endKey   = prevRangeEnd.slice(0, 7);
    return allEntries
      .filter((e) => e.key >= startKey && e.key <= endKey && e.tipo !== "receita")
      .reduce((s, e) => s + e.value, 0);
  }, [allEntries, prevRangeStart, prevRangeEnd]);

  const deltaPercent = totalPrevRangeDespesas > 0
    ? Math.round(((totalDespesas - totalPrevRangeDespesas) / totalPrevRangeDespesas) * 100)
    : null;

  const curEntries = useMemo(
    () => allEntries.filter((e) => e.key === curKey && e.tipo !== "receita"),
    [allEntries, curKey]
  );
  const totalMesDespesas = curEntries.reduce((s, e) => s + e.value, 0);

  const curIncomeEntries = useMemo(
    () => allEntries.filter((e) => e.key === curKey && e.tipo === "receita"),
    [allEntries, curKey]
  );
  const totalMesReceitas = curIncomeEntries.reduce((s, e) => s + e.value, 0);

  // Por categoria (mês atual) - Despesas
  const byCategory = useMemo(() => {
    const map = {};
    curEntries.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.value; });
    return Object.entries(map)
      .map(([key, value]) => ({ key, value, ...catByKey[key] }))
      .sort((a, b) => b.value - a.value);
  }, [curEntries, catByKey]);

  // Por categoria (mês atual) - Receitas
  const incomeByCategory = useMemo(() => {
    const map = {};
    curIncomeEntries.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.value; });
    return Object.entries(map)
      .map(([key, value]) => ({ key, value, ...catByKey[key] }))
      .sort((a, b) => b.value - a.value);
  }, [curIncomeEntries, catByKey]);

  // Por forma de pagamento (mês atual)
  const byPaymentMethod = useMemo(() => {
    const map = {};
    // Crédito: usa installment entries
    curEntries.forEach((e) => {
      const exp = expenses.find(ex => ex.id === e.id);
      const fp = exp?.formaPagamento || "credito";
      map[fp] = (map[fp] || 0) + e.value;
    });
    // Não-crédito: gastos cujo mês da data coincide com o mês atual
    expenses.forEach((exp) => {
      const fp = exp.formaPagamento;
      if (fp && fp !== "credito" && exp.data.slice(0, 7) === curKey) {
        // Já contabilizado via installment entries acima
      }
    });
    return PAYMENT_METHODS
      .map((m) => ({ ...m, value: map[m.key] || 0 }))
      .filter((m) => m.value > 0);
  }, [curEntries, expenses, curKey]);

  // Por cartão de crédito (mês atual)
  const byCard = useMemo(() => {
    const map = {};
    curEntries.forEach((e) => {
      const exp = expenses.find(ex => ex.id === e.id);
      if ((exp?.formaPagamento || "credito") !== "credito") return;
      if (!e.cartao) return;
      map[e.cartao] = (map[e.cartao] || 0) + e.value;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [curEntries, expenses]);

  // ── Gráfico: 4 meses anteriores + atual + 4 futuros ──
  const chartData = useMemo(() => {
    const keys = [];
    for (let i = -4; i <= 4; i++) keys.push(shiftMonthKey(curKey, i));
    return keys.map((key) => {
      const isFuture = key > curKey;
      const isCurrent = key === curKey;
      const despesas = allEntries
        .filter((e) => e.key === key && e.tipo !== "receita")
        .reduce((s, e) => s + e.value, 0);
      const receitas = allEntries
        .filter((e) => e.key === key && e.tipo === "receita")
        .reduce((s, e) => s + e.value, 0);
      return {
        key,
        label: monthLabel(key),
        realizado: isFuture ? 0 : despesas,
        projecao: isFuture ? despesas : 0,
        receitas,
        isFuture,
        isCurrent,
        total: despesas, // para tooltip
      };
    });
  }, [allEntries, curKey]);

  const onlyExpenses = useMemo(() => expenses.filter(e => e.tipo !== "receita"), [expenses]);

  // Últimas 5 compras
  const recent = useMemo(
    () => [...onlyExpenses].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5),
    [onlyExpenses]
  );

  // Stats rápidas
  const avgExpense = onlyExpenses.length > 0
    ? onlyExpenses.reduce((s, e) => s + e.valor, 0) / onlyExpenses.length
    : 0;
  const topCategory = byCategory[0];

  // Insights Inteligentes
  const insights = useMemo(() => {
    const list = [];
    if (deltaPercent !== null) {
      if (deltaPercent > 0) list.push({ icon: "⚠️", text: `Atenção: Seus gastos subiram ${deltaPercent}% em relação ao período anterior.` });
      else if (deltaPercent < 0) list.push({ icon: "🎉", text: `Ótimo! Você economizou ${Math.abs(deltaPercent)}% em relação ao período anterior.` });
    }
    if (topCategory && totalMesDespesas > 0 && (topCategory.value / totalMesDespesas) > 0.4) {
      list.push({ icon: "📊", text: `${topCategory.label} representa mais de 40% das suas despesas este mês.` });
    }
    if (list.length === 0) list.push({ icon: "💡", text: "Tudo sob controle por aqui. Continue registrando seus gastos!" });
    return list;
  }, [deltaPercent, topCategory, totalMesDespesas]);

  // Atalhos de período
  const presets = [
    {
      label: "Hoje",
      fn: () => { setRangeStart(today); setRangeEnd(today); },
    },
    {
      label: "Esta semana",
      fn: () => {
        const d = new Date();
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        setRangeStart(monday.toISOString().slice(0, 10));
        setRangeEnd(today);
      },
    },
    {
      label: "Este mês",
      fn: () => { setRangeStart(firstOfCurrentMonth()); setRangeEnd(today); },
    },
    {
      label: "Últ. 30 dias",
      fn: () => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setRangeStart(d.toISOString().slice(0, 10));
        setRangeEnd(today);
      },
    },
    {
      label: "Últ. 3 meses",
      fn: () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        setRangeStart(d.toISOString().slice(0, 10));
        setRangeEnd(today);
      },
    },
  ];

  if (expenses.length === 0) {
    return (
      <div className="card tab-enter">
        <div className="empty">
          <span className="empty__icon">💰</span>
          <p style={{ fontWeight: 600, color: "var(--text)" }}>Nenhum lançamento cadastrado</p>
          <p>Adicione o primeiro lançamento na aba <strong>"Novo"</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="tab-enter" 
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      
      {/* Insights */}
      <motion.div 
        className="card" 
        style={{ background: "linear-gradient(to right, rgba(91,141,239,0.05), var(--bg-card))", borderLeft: "3px solid var(--blue)", padding: "12px 16px" }}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--blue)", marginBottom: 8 }}>
          <Lightbulb size={14} /> Insights do Período
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {insights.map((insight, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{insight.icon}</span>
              <span>{insight.text}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* KPI Principal com seletor de período */}
      <motion.div 
        className="card" 
        style={{ border: "1px solid rgba(230,180,74,0.3)", background: "linear-gradient(135deg, rgba(230,180,74,0.06) 0%, var(--bg-card) 100%)" }}
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--gold)" }}>
          <Calendar size={13} /> Balanço do período
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.fn}
              style={{
                background: "rgba(230,180,74,0.08)",
                border: "1px solid rgba(230,180,74,0.2)",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 11,
                color: "var(--text-muted)",
                cursor: "pointer",
                transition: "all .15s",
              }}
              onMouseOver={e => { e.currentTarget.style.color = "var(--gold)"; e.currentTarget.style.borderColor = "var(--gold)"; }}
              onMouseOut={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "rgba(230,180,74,0.2)"; }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Inputs de data */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <input
            type="date"
            className="input"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            style={{ flex: 1, fontSize: 13, padding: "7px 10px" }}
            aria-label="Data inicial do período"
          />
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>até</span>
          <input
            type="date"
            className="input"
            value={rangeEnd}
            min={rangeStart}
            onChange={(e) => setRangeEnd(e.target.value)}
            style={{ flex: 1, fontSize: 13, padding: "7px 10px" }}
            aria-label="Data final do período"
          />
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Saldo do período</p>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 32, fontWeight: 700, color: rangeSaldo >= 0 ? "var(--sage)" : "var(--rust)", letterSpacing: "-0.5px", marginBottom: 12 }}>
          {formatBRL(rangeSaldo)}
        </p>
        
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          {/* Entradas */}
          <div style={{
            flex: 1, background: "rgba(61, 214, 140, 0.08)", border: "1px solid rgba(61, 214, 140, 0.15)",
            borderRadius: 8, padding: "8px 12px", fontSize: 12,
          }}>
            <span style={{ color: "var(--text-dim)", display: "block", marginBottom: 2 }}>🟢 Entradas</span>
            <span style={{ color: "var(--sage)", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>
              +{formatBRL(totalReceitas)}
            </span>
          </div>

          {/* Saídas */}
          <div style={{
            flex: 1, background: "rgba(230, 82, 82, 0.08)", border: "1px solid rgba(230, 82, 82, 0.15)",
            borderRadius: 8, padding: "8px 12px", fontSize: 12,
          }}>
            <span style={{ color: "var(--text-dim)", display: "block", marginBottom: 2 }}>🔴 Saídas</span>
            <span style={{ color: "var(--rust)", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>
              -{formatBRL(totalDespesas)}
            </span>
          </div>
        </div>

        {/* Detalhamento das saídas (à vista vs parcelado) */}
        {totalDespesas > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            {rangeAvista > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>
                À vista: {formatBRL(rangeAvista)}
              </span>
            )}
            {rangeParcelado > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>
                Parcelas: {formatBRL(rangeParcelado)}
              </span>
            )}
          </div>
        )}

        <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
          <span>{rangeNumCompras} compra{rangeNumCompras !== 1 ? "s" : ""} no período</span>
          {deltaPercent !== null && (
            <span style={{
              display: "flex", alignItems: "center", gap: 3,
              color: deltaPercent > 0 ? "#E05252" : "#3DD68C",
              fontWeight: 600, fontSize: 12,
            }}>
              {deltaPercent > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {deltaPercent > 0 ? "+" : ""}{deltaPercent}% vs período anterior
            </span>
          )}
        </p>
      </motion.div>

      {/* Stats rápidas */}
      <motion.div className="stat-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="stat-card">
          <div className="stat-card__label">Total compras</div>
          <div className="stat-card__value">{onlyExpenses.length}</div>
          <div className="stat-card__sub">no histórico</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Ticket médio</div>
          <div className="stat-card__value">{formatBRL(avgExpense)}</div>
          <div className="stat-card__sub">por compra</div>
        </div>
        {topCategory && (
          <>
            <div className="stat-card">
              <div className="stat-card__label">Maior categoria</div>
              <div className="stat-card__value" style={{ fontSize: 15 }}>
                {topCategory.icon} {topCategory.label}
              </div>
              <div className="stat-card__sub">{formatBRL(topCategory.value)} no mês</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Cartões usados</div>
              <div className="stat-card__value">{byCard.length}</div>
              <div className="stat-card__sub">este mês</div>
            </div>
          </>
        )}
      </motion.div>

      {/* Metas e Limites (Budgets) */}
      {Object.values(budgets).some(v => v > 0) && (
        <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <p className="section-title">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Target size={13} /> Orçamento do Mês — {monthLabel(curKey)}
            </span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {categories.map((cat) => {
              const limit = budgets[cat.key] || 0;
              if (limit <= 0) return null;
              
              const spent = byCategory.find(c => c.key === cat.key)?.value || 0;
              const pct = Math.min(100, Math.round((spent / limit) * 100));
              const isOver = spent > limit;
              const barColor = isOver ? "var(--rust)" : (pct > 85 ? "var(--gold)" : cat.color);

              return (
                <div key={cat.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--text-muted)" }}>{cat.icon} {cat.label}</span>
                    <span style={{ color: isOver ? "var(--rust)" : "var(--text)" }}>
                      <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatBRL(spent)}</strong> / {formatBRL(limit)}
                    </span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                    <motion.div 
                      style={{ background: barColor, height: "100%", borderRadius: 3 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Pie Chart — Categorias (mês atual) */}
      {byCategory.length > 0 && (
        <div className="card">
          <p className="section-title">Saídas por categoria — {monthLabel(curKey)}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                strokeWidth={0}
              >
                {byCategory.map((c) => <Cell key={c.key} fill={c.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div>
            {byCategory.map((c) => (
              <div className="legend-row" key={c.key}>
                <span className="legend-row__dot" style={{ background: c.color }} />
                <span className="legend-row__label">{c.icon} {c.label}</span>
                <div className="legend-row__bar-wrap">
                  <div
                    className="legend-row__bar"
                    style={{ background: c.color, width: `${Math.round((c.value / totalMesDespesas) * 100)}%` }}
                  />
                </div>
                <span className="legend-row__value">{formatBRL(c.value)}</span>
                <span className="legend-row__pct">{Math.round((c.value / totalMesDespesas) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pie Chart — Entradas (mês atual) */}
      {incomeByCategory.length > 0 && (
        <div className="card" style={{ border: "1px solid rgba(61, 214, 140, 0.2)" }}>
          <p className="section-title" style={{ color: "var(--sage)" }}>Entradas por categoria — {monthLabel(curKey)}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={incomeByCategory}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                strokeWidth={0}
              >
                {incomeByCategory.map((c) => <Cell key={c.key} fill={c.color || "var(--sage)"} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div>
            {incomeByCategory.map((c) => (
              <div className="legend-row" key={c.key}>
                <span className="legend-row__dot" style={{ background: c.color || "var(--sage)" }} />
                <span className="legend-row__label">{c.icon} {c.label}</span>
                <div className="legend-row__bar-wrap">
                  <div
                    className="legend-row__bar"
                    style={{ background: c.color || "var(--sage)", width: `${Math.round((c.value / totalMesReceitas) * 100)}%` }}
                  />
                </div>
                <span className="legend-row__value" style={{ color: "var(--sage)" }}>+{formatBRL(c.value)}</span>
                <span className="legend-row__pct">{Math.round((c.value / totalMesReceitas) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bar Chart — evolução + projeção futura */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>Evolução mensal</p>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-dim)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--sage)", display: "inline-block" }} />
              Entradas
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#E6B44A", display: "inline-block" }} />
              Saídas
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#5B8DEF", display: "inline-block", opacity: 0.6 }} />
              Projeção
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3550" vertical={false} />
            <XAxis
              dataKey="label"
              tick={({ x, y, payload, index }) => {
                const item = chartData[index];
                const fill = item?.isFuture ? "#5B8DEF" : item?.isCurrent ? "#E6B44A" : "#7A8AAD";
                return (
                  <text x={x} y={y + 12} textAnchor="middle" fill={fill} fontSize={10}>
                    {payload.value}
                  </text>
                );
              }}
              axisLine={{ stroke: "#2A3550" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#7A8AAD", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              width={38}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const realizado = payload.find(p => p.dataKey === "realizado")?.value || 0;
                const projecao  = payload.find(p => p.dataKey === "projecao")?.value || 0;
                const receitas  = payload.find(p => p.dataKey === "receitas")?.value || 0;
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip__label">{label}</div>
                    {receitas > 0 && (
                      <div className="chart-tooltip__value" style={{ color: "var(--sage)" }}>+{formatBRL(receitas)}</div>
                    )}
                    {realizado > 0 && (
                      <div className="chart-tooltip__value">-{formatBRL(realizado)}</div>
                    )}
                    {projecao > 0 && (
                      <div style={{ fontSize: 12, color: "#5B8DEF", marginTop: 2 }}>
                        Projeção (saídas): {formatBRL(projecao)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {/* Linha divisória: hoje */}
            <ReferenceLine x={monthLabel(curKey)} stroke="#E6B44A" strokeDasharray="4 3" strokeWidth={1.5} />
            <Bar dataKey="receitas" fill="var(--sage)" radius={[5, 5, 0, 0]} opacity={0.85} />
            <Bar dataKey="realizado" fill="#E6B44A" radius={[5, 5, 0, 0]} opacity={0.85} />
            <Bar dataKey="projecao"  fill="#5B8DEF" radius={[5, 5, 0, 0]} opacity={0.55} />
            <Line
              type="monotone"
              dataKey="realizado"
              stroke="#F5D07A"
              strokeWidth={2}
              dot={{ fill: "#F5D07A", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", marginTop: 4 }}>
          Barras azuis = projeção de parcelas futuras
        </p>
      </div>

      {/* Por Forma de Pagamento */}
      {byPaymentMethod.length > 0 && (
        <div className="card">
          <p className="section-title">Por forma de pagamento — {monthLabel(curKey)}</p>
          {byPaymentMethod.map((m) => (
            <div className="legend-row" key={m.key}>
              <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{m.icon}</span>
              <span className="legend-row__label" style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>
              <div className="legend-row__bar-wrap">
                <div
                  className="legend-row__bar"
                  style={{ background: m.color, width: `${Math.round((m.value / totalMesDespesas) * 100)}%` }}
                />
              </div>
              <span className="legend-row__value">{formatBRL(m.value)}</span>
              <span className="legend-row__pct">{Math.round((m.value / totalMesDespesas) * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Por Cartão de Crédito */}
      {byCard.length > 0 && (
        <div className="card">
          <p className="section-title">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CreditCard size={13} /> Por cartão de crédito — {monthLabel(curKey)}
            </span>
          </p>
          <ResponsiveContainer width="100%" height={Math.max(120, byCard.length * 50)}>
            <BarChart
              data={byCard}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3550" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#7A8AAD", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#E2E8F5", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#5B8DEF" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Lançamentos recentes */}
      <div className="card">
        <p className="section-title">Lançamentos recentes</p>
        {recent.map((e) => {
          const cat = catByKey[e.categoria];
          return (
            <div className="list-row" key={e.id}>
              <div
                className="list-row__icon"
                style={{ background: `${cat?.color}22` }}
              >
                {cat?.icon}
              </div>
              <div className="list-row__main">
                <div className="list-row__desc">{e.descricao}</div>
                <div className="list-row__meta">
                  {e.data.split("-").reverse().join("/")} · {e.cartao}
                  {e.parcelas > 1 && (
                    <span className="badge badge--parcelas" style={{ marginLeft: 6 }}>
                      {e.parcelas}x
                    </span>
                  )}
                </div>
              </div>
              <span className="list-row__value">{formatBRL(e.valor)}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
