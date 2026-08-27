import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, ReferenceLine,
} from "recharts";
import { Wallet, TrendingUp, TrendingDown, CreditCard, Calendar } from "lucide-react";

import {
  formatBRL, currentMonthKey, monthLabel, shiftMonthKey, getInstallmentEntries, todayISO,
} from "../utils/format";

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

export default function Dashboard({ expenses, categories }) {
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
    () => expenses.flatMap((e) => getInstallmentEntries(e)),
    [expenses]
  );

  // ── KPI: filtra por intervalo de DATAS (usa data da compra original) ──
  const rangeExpenses = useMemo(() => {
    if (!rangeStart || !rangeEnd) return expenses;
    return expenses.filter((e) => e.data >= rangeStart && e.data <= rangeEnd);
  }, [expenses, rangeStart, rangeEnd]);

  const totalRange = rangeExpenses.reduce((s, e) => s + e.valor, 0);
  const rangeEntries = rangeExpenses.length;

  // Comparativo: mesmo intervalo de dias no período anterior
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

  const totalPrevRange = useMemo(() => {
    if (!prevRangeStart || !prevRangeEnd) return 0;
    return expenses
      .filter((e) => e.data >= prevRangeStart && e.data <= prevRangeEnd)
      .reduce((s, e) => s + e.valor, 0);
  }, [expenses, prevRangeStart, prevRangeEnd]);

  const deltaPercent = totalPrevRange > 0
    ? Math.round(((totalRange - totalPrevRange) / totalPrevRange) * 100)
    : null;

  // ── Mês atual para gráfico de pizza e cartões ──
  const curEntries = useMemo(
    () => allEntries.filter((e) => e.key === curKey),
    [allEntries, curKey]
  );
  const totalMes = curEntries.reduce((s, e) => s + e.value, 0);

  // Por categoria (mês atual)
  const byCategory = useMemo(() => {
    const map = {};
    curEntries.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.value; });
    return Object.entries(map)
      .map(([key, value]) => ({ key, value, ...catByKey[key] }))
      .sort((a, b) => b.value - a.value);
  }, [curEntries, catByKey]);

  // Por cartão (mês atual)
  const byCard = useMemo(() => {
    const map = {};
    curEntries.forEach((e) => { map[e.cartao] = (map[e.cartao] || 0) + e.value; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [curEntries]);

  // ── Gráfico: 4 meses anteriores + atual + 4 futuros ──
  const chartData = useMemo(() => {
    const keys = [];
    for (let i = -4; i <= 4; i++) keys.push(shiftMonthKey(curKey, i));
    return keys.map((key) => {
      const isFuture = key > curKey;
      const isCurrent = key === curKey;
      const total = allEntries
        .filter((e) => e.key === key)
        .reduce((s, e) => s + e.value, 0);
      return {
        key,
        label: monthLabel(key),
        realizado: isFuture ? 0 : total,
        projecao: isFuture ? total : 0,
        isFuture,
        isCurrent,
        total, // para tooltip
      };
    });
  }, [allEntries, curKey]);

  // Últimas 5 compras
  const recent = useMemo(
    () => [...expenses].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5),
    [expenses]
  );

  // Stats rápidas
  const avgExpense = expenses.length > 0
    ? expenses.reduce((s, e) => s + e.valor, 0) / expenses.length
    : 0;
  const topCategory = byCategory[0];

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
          <p style={{ fontWeight: 600, color: "var(--text)" }}>Nenhum gasto cadastrado</p>
          <p>Adicione o primeiro gasto na aba <strong>"Novo"</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI Principal com seletor de período */}
      <div className="card" style={{ border: "1px solid rgba(230,180,74,0.3)", background: "linear-gradient(135deg, rgba(230,180,74,0.06) 0%, var(--bg-card) 100%)" }}>
        <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--gold)" }}>
          <Calendar size={13} /> Total do período
        </p>

        {/* Atalhos rápidos */}
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

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total</p>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 32, fontWeight: 700, color: "var(--gold)", letterSpacing: "-0.5px", marginBottom: 8 }}>
          {formatBRL(totalRange)}
        </p>
        <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
          <span>{rangeEntries} compra{rangeEntries !== 1 ? "s" : ""} no período</span>
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
      </div>

      {/* Stats rápidas */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total compras</div>
          <div className="stat-card__value">{expenses.length}</div>
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
      </div>

      {/* Pie Chart — Categorias (mês atual) */}
      {byCategory.length > 0 && (
        <div className="card">
          <p className="section-title">Gastos por categoria — {monthLabel(curKey)}</p>
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
                    style={{ background: c.color, width: `${Math.round((c.value / totalMes) * 100)}%` }}
                  />
                </div>
                <span className="legend-row__value">{formatBRL(c.value)}</span>
                <span className="legend-row__pct">{Math.round((c.value / totalMes) * 100)}%</span>
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
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#E6B44A", display: "inline-block" }} />
              Realizado
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
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip__label">{label}</div>
                    {realizado > 0 && (
                      <div className="chart-tooltip__value">{formatBRL(realizado)}</div>
                    )}
                    {projecao > 0 && (
                      <div style={{ fontSize: 12, color: "#5B8DEF", marginTop: 2 }}>
                        Projeção: {formatBRL(projecao)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {/* Linha divisória: hoje */}
            <ReferenceLine x={monthLabel(curKey)} stroke="#E6B44A" strokeDasharray="4 3" strokeWidth={1.5} />
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

      {/* Por Cartão */}
      {byCard.length > 0 && (
        <div className="card">
          <p className="section-title">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CreditCard size={13} /> Por cartão — {monthLabel(curKey)}
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
    </div>
  );
}
