import { useMemo, useState, useCallback } from "react";
import { Trash2, Search, Download, Pencil } from "lucide-react";
import { PAYMENT_METHODS } from "../constants";

import {
  formatBRL, formatDateBR, monthKeyOf, monthLabel,
  getInstallmentEntries,
} from "../utils/format";

function exportCSV(data, categories) {
  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c]));
  const headers = ["Data", "Descrição", "Categoria", "Cartão", "Parcelas", "Valor Total", "Valor Parcela", "Notas"];
  const rows = data.map((e) => [
    formatDateBR(e.data),
    `"${e.descricao.replace(/"/g, '""')}"`,
    catByKey[e.categoria]?.label || e.categoria,
    e.cartao,
    e.parcelas,
    e.valor.toFixed(2).replace(".", ","),
    (e.valor / e.parcelas).toFixed(2).replace(".", ","),
    `"${(e.notas || "").replace(/"/g, '""')}"`,
  ]);
  const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recibo-gastos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Report({ expenses, cards, categories, onDeleteRequest, onEditRequest }) {
  const [filterMonth,     setFilterMonth]     = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterCartao,    setFilterCartao]    = useState("todos");
  const [filterForma,     setFilterForma]     = useState("todos");
  const [search,          setSearch]          = useState("");

  const catByKey = useMemo(() => {
    return Object.fromEntries(categories.map((c) => [c.key, c]));
  }, [categories]);

  const allEntries = useMemo(
    () => expenses.flatMap((e) => getInstallmentEntries(e)),
    [expenses]
  );

  const monthsAvailable = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKeyOf(e.data)));
    allEntries.forEach((e) => set.add(e.key));
    return [...set].sort().reverse();
  }, [expenses, allEntries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return expenses
      .filter((e) => filterMonth     === "todos" || monthKeyOf(e.data) === filterMonth)
      .filter((e) => filterCategoria === "todos" || e.categoria         === filterCategoria)
      .filter((e) => filterCartao    === "todos" || e.cartao            === filterCartao)
      .filter((e) => filterForma     === "todos" || (e.formaPagamento || "credito") === filterForma)
      .filter((e) =>
        !q ||
        e.descricao.toLowerCase().includes(q) ||
        (e.notas || "").toLowerCase().includes(q) ||
        e.cartao.toLowerCase().includes(q)
      )
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [expenses, filterMonth, filterCategoria, filterCartao, filterForma, search]);

  const faturaMes = useMemo(() => {
    if (filterMonth === "todos") return null;
    return allEntries
      .filter((e) => e.key         === filterMonth)
      .filter((e) => filterCategoria === "todos" || e.categoria === filterCategoria)
      .filter((e) => filterCartao    === "todos" || e.cartao    === filterCartao)
      .filter((e) => {
        if (filterForma === "todos") return true;
        const exp = expenses.find(ex => ex.id === e.id);
        return (exp?.formaPagamento || "credito") === filterForma;
      })
      .reduce((s, e) => s + e.value, 0);
  }, [allEntries, filterMonth, filterCategoria, filterCartao, filterForma, expenses]);

  const totalCompras = filtered.reduce((s, e) => s + e.valor, 0);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.valor; });
    return Object.entries(map)
      .map(([key, value]) => ({ key, value, ...catByKey[key] }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, catByKey]);

  return (
    <div className="tab-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtros */}
      <div className="card">
        <p className="section-title">Filtros</p>
        <div className="filters">
          {/* Busca */}
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              className="input"
              placeholder="Buscar descrição, notas, cartão..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="campo-busca"
            />
          </div>
          <div className="filters__row">
            <div>
              <select
                className="select"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                aria-label="Filtrar por mês"
              >
                <option value="todos">Todos os meses</option>
                {monthsAvailable.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="select"
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                aria-label="Filtrar por categoria"
              >
                <option value="todos">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="filters__row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <select
                className="select"
                value={filterCartao}
                onChange={(e) => setFilterCartao(e.target.value)}
                aria-label="Filtrar por cartão"
              >
                <option value="todos">Todos os cartões</option>
                {cards.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <select
                className="select"
                value={filterForma}
                onChange={(e) => setFilterForma(e.target.value)}
                aria-label="Filtrar por forma de pagamento"
              >
                <option value="todos">Todas as formas</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            className="csv-btn"
            onClick={() => exportCSV(filtered, categories)}
            disabled={filtered.length === 0}
            title="Exportar CSV"
            id="btn-exportar-csv"
            style={{
              width: "100%", padding: "12px", borderRadius: "12px", 
              background: "rgba(61, 214, 140, 0.1)", border: "1px solid var(--sage)", 
              color: "var(--sage)", display: "flex", justifyContent: "center", 
              alignItems: "center", gap: 8, fontWeight: 600, transition: "all 0.2s"
            }}
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Fatura estimada */}
      {filterMonth !== "todos" && faturaMes !== null && (
        <div className="paper">
          <div className="paper__inner">
            <p className="paper__label">Fatura estimada · {monthLabel(filterMonth)}</p>
            <p className="paper__value">{formatBRL(faturaMes)}</p>
            <p className="paper__foot">Soma das parcelas que vencem neste mês, incluindo compras de meses anteriores</p>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>
            Compras ({filtered.length})
          </p>
          {filtered.length > 0 && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--gold)" }}>
              {formatBRL(totalCompras)}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty" style={{ paddingTop: 24, paddingBottom: 24 }}>
            <span className="empty__icon">🔍</span>
            <p>Nenhum gasto encontrado com esses filtros.</p>
          </div>
        ) : (
          <>
            {/* Mobile list */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filtered.map((e) => {
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
                        {formatDateBR(e.data)}
                        {" · "}
                        {(() => {
                          const pm = PAYMENT_METHODS.find(m => m.key === (e.formaPagamento || "credito"));
                          return <span style={{ color: pm?.color }}>{pm?.icon} {pm?.label}</span>;
                        })()}
                        {e.cartao && ` · ${e.cartao}`}
                        {" · "}{cat?.label}
                        {e.parcelas > 1 && (
                          <span className="badge badge--parcelas" style={{ marginLeft: 6 }}>
                            {e.parcelas}x de {formatBRL(e.valor / e.parcelas)}
                          </span>
                        )}
                      </div>
                      {e.notas && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, fontStyle: "italic" }}>
                          {e.notas}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span className="list-row__value">{formatBRL(e.valor)}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="del-btn"
                          style={{ color: "var(--text-muted)" }}
                          onClick={() => onEditRequest(e)}
                          aria-label={`Editar ${e.descricao}`}
                          id={`btn-edit-${e.id}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="del-btn"
                          onClick={() => onDeleteRequest(e)}
                          aria-label={`Excluir ${e.descricao}`}
                          id={`btn-del-${e.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            <div style={{
              borderTop: "1.5px solid var(--gold)",
              marginTop: 8,
              paddingTop: 10,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--gold)",
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              <span>Total das compras</span>
              <span>{formatBRL(totalCompras)}</span>
            </div>
          </>
        )}
      </div>

      {/* Resumo por categoria */}
      {byCategory.length > 0 && (
        <div className="card">
          <p className="section-title">Resumo por categoria</p>
          {byCategory.map((c) => (
            <div className="legend-row" key={c.key}>
              <span className="legend-row__dot" style={{ background: c.color }} />
              <span className="legend-row__label">{c.icon} {c.label}</span>
              <div style={{ flex: 1, padding: "0 10px" }}>
                <div className="progress-wrap" style={{ height: 5 }}>
                  <div
                    className="progress-bar progress-bar--ok"
                    style={{ background: c.color, width: `${Math.round((c.value / totalCompras) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="legend-row__value">{formatBRL(c.value)}</span>
              <span className="legend-row__pct">{Math.round((c.value / totalCompras) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
