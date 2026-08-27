import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart,
} from "recharts";
import { Wallet, TrendingUp, TrendingDown, CreditCard } from "lucide-react";

import {
  formatBRL, currentMonthKey, monthLabel, shiftMonthKey, getInstallmentEntries,
} from "../utils/format";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip__label">{label}</div>}
      <div className="chart-tooltip__value">{formatBRL(payload[0].value)}</div>
    </div>
  );
}

export default function Dashboard({ expenses, categories }) {
  const curKey = currentMonthKey();

  const catByKey = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c])),
    [categories]
  );

  const allEntries = useMemo(
    () => expenses.flatMap((e) => getInstallmentEntries(e)),
    [expenses]
  );

  const curEntries = useMemo(
    () => allEntries.filter((e) => e.key === curKey),
    [allEntries, curKey]
  );

  const totalMes = curEntries.reduce((s, e) => s + e.value, 0);

  // Mês anterior para comparação
  const prevKey = shiftMonthKey(curKey, -1);
  const prevEntries = allEntries.filter((e) => e.key === prevKey);
  const totalPrev = prevEntries.reduce((s, e) => s + e.value, 0);
  const deltaPercent = totalPrev > 0
    ? Math.round(((totalMes - totalPrev) / totalPrev) * 100)
    : null;

  // Por categoria (mês atual)
  const byCategory = useMemo(() => {
    const map = {};
    curEntries.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.value; });
    return Object.entries(map)
      .map(([key, value]) => ({ key, value, ...catByKey[key] }))
      .sort((a, b) => b.value - a.value);
  }, [curEntries]);

  // Por cartão (mês atual)
  const byCard = useMemo(() => {
    const map = {};
    curEntries.forEach((e) => { map[e.cartao] = (map[e.cartao] || 0) + e.value; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [curEntries]);

  // Últimos 6 meses
  const last6 = useMemo(() => {
    const keys = [];
    for (let i = 5; i >= 0; i--) keys.push(shiftMonthKey(curKey, -i));
    return keys.map((key) => ({
      key,
      label: monthLabel(key),
      total: allEntries.filter((e) => e.key === key).reduce((s, e) => s + e.value, 0),
    }));
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
      {/* KPI Principal */}
      <div className="paper">
        <div className="paper__inner">
          <p className="paper__label">Total do mês · {monthLabel(curKey)}</p>
          <p className="paper__value">{formatBRL(totalMes)}</p>
          <p className="paper__foot" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{curEntries.length} lançamento{curEntries.length !== 1 ? "s" : ""} (incl. parcelas anteriores)</span>
            {deltaPercent !== null && (
              <span style={{
                display: "flex", alignItems: "center", gap: 3,
                color: deltaPercent > 0 ? "#E05252" : "#3DD68C",
                fontWeight: 600, fontSize: 12,
              }}>
                {deltaPercent > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {deltaPercent > 0 ? "+" : ""}{deltaPercent}% vs mês anterior
              </span>
            )}
          </p>
        </div>
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

      {/* Pie Chart — Categorias */}
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

      {/* Bar Chart — 6 meses com linha de tendência */}
      <div className="card">
        <p className="section-title">Evolução mensal — 6 meses</p>
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={last6} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3550" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#7A8AAD", fontSize: 11 }}
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
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total" fill="#E6B44A" radius={[5, 5, 0, 0]} opacity={0.85} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#F5D07A"
              strokeWidth={2}
              dot={{ fill: "#F5D07A", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
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
