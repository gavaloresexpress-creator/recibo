import { useMemo, useState, useCallback } from "react";
import { Trash2, Search, Download, Pencil } from "lucide-react";
import { PAYMENT_METHODS } from "../constants";

import {
  formatBRL, formatDateBR, monthKeyOf, monthLabel,
  getInstallmentEntries,
} from "../utils/format";

function exportCSV(data, categories) {
  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c]));
  const headers = ["Data", "Descrição", "Categoria", "Tipo", "Cartão", "Parcelas", "Valor Total", "Valor Parcela", "Notas"];
  const rows = data.map((e) => [
    formatDateBR(e.data),
    `"${e.descricao.replace(/"/g, '""')}"`,
    catByKey[e.categoria]?.label || e.categoria,
    e.tipo === "receita" ? "Receita" : "Despesa",
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
  const [filterMonth,     setFilterMonth]     = useState([]);
  const [filterCategoria, setFilterCategoria] = useState([]);
  const [filterCartao,    setFilterCartao]    = useState([]);
  const [filterForma,     setFilterForma]     = useState([]);
  const [filterTipo,      setFilterTipo]      = useState([]);
  const [search,          setSearch]          = useState("");
  const [startDate,       setStartDate]       = useState("");
  const [endDate,         setEndDate]         = useState("");

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
      .filter((e) => filterMonth.length === 0     || filterMonth.includes(monthKeyOf(e.data)))
      .filter((e) => filterCategoria.length === 0 || filterCategoria.includes(e.categoria))
      .filter((e) => filterCartao.length === 0    || filterCartao.includes(e.cartao))
      .filter((e) => filterForma.length === 0     || filterForma.includes(e.formaPagamento || "credito"))
      .filter((e) => filterTipo.length === 0      || filterTipo.includes(e.tipo || "despesa"))
      .filter((e) => !startDate || e.data >= startDate)
      .filter((e) => !endDate   || e.data <= endDate)
      .filter((e) =>
        !q ||
        (e.descricao || "").toLowerCase().includes(q) ||
        (e.notas || "").toLowerCase().includes(q) ||
        (e.cartao || "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [expenses, filterMonth, filterCategoria, filterCartao, filterForma, filterTipo, search, startDate, endDate]);

  const faturaMes = useMemo(() => {
    if (filterMonth.length !== 1) return null; // Fatura estimada só faz sentido para 1 mês exato
    const mes = filterMonth[0];
    return allEntries
      .filter((e) => e.key === mes)
      .filter((e) => filterCategoria.length === 0 || filterCategoria.includes(e.categoria))
      .filter((e) => filterCartao.length === 0    || filterCartao.includes(e.cartao))
      .filter((e) => {
        if (filterForma.length === 0) return true;
        const exp = expenses.find(ex => ex.id === e.id);
        return filterForma.includes(exp?.formaPagamento || "credito");
      })
      .reduce((s, e) => s + e.value, 0);
  }, [allEntries, filterMonth, filterCategoria, filterCartao, filterForma, expenses]);

  const totalCompras = filtered.filter(e => e.tipo !== "receita").reduce((s, e) => s + e.valor, 0);
  const totalReceitas = filtered.filter(e => e.tipo === "receita").reduce((s, e) => s + e.valor, 0);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.categoria] = (map[e.categoria] || 0) + e.valor; });
    return Object.entries(map)
      .map(([key, value]) => ({ key, value, ...catByKey[key] }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, catByKey]);

  // Componente interno para multi-select
  const MultiSelect = ({ label, options, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const isAll = value.length === 0;

    const toggle = (val) => {
      if (value.includes(val)) {
        onChange(value.filter(v => v !== val));
      } else {
        onChange([...value, val]);
      }
    };

    return (
      <div style={{ position: "relative" }}>
        <button 
          type="button"
          className="select" 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: 'rgba(13,17,23,0.8)' }}
          onClick={() => setOpen(!open)}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>
            {isAll ? label : `${value.length} selec.`}
          </span>
          <span style={{ fontSize: '10px', marginLeft: '4px' }}>▼</span>
        </button>

        {open && (
          <>
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 9 }} 
              onClick={() => setOpen(false)}
            />
            <div style={{
              position: "absolute", top: "100%", left: 0, minWidth: "100%", 
              background: "var(--bg-card)", border: "1px solid var(--border)", 
              borderRadius: "8px", marginTop: "4px", zIndex: 10,
              maxHeight: "220px", overflowY: "auto",
              boxShadow: "var(--shadow-card)", padding: "6px",
              display: "flex", flexDirection: "column", gap: "2px"
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                <input 
                  type="checkbox" 
                  checked={isAll} 
                  onChange={() => onChange([])}
                  style={{ accentColor: 'var(--gold)' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Todos</span>
              </label>
              {options.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px' }} className="hover-bg">
                  <input 
                    type="checkbox" 
                    checked={value.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    style={{ accentColor: 'var(--gold)' }}
                  />
                  <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

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
              <MultiSelect
                label="Meses"
                value={filterMonth}
                onChange={setFilterMonth}
                options={monthsAvailable.map(m => ({ value: m, label: monthLabel(m) }))}
              />
            </div>
            <div>
              <MultiSelect
                label="Categorias"
                value={filterCategoria}
                onChange={setFilterCategoria}
                options={categories.map(c => ({ value: c.key, label: `${c.icon} ${c.label}` }))}
              />
            </div>
            <div>
              <MultiSelect
                label="Tipos"
                value={filterTipo}
                onChange={setFilterTipo}
                options={[
                  { value: "despesa", label: "Saídas" },
                  { value: "receita", label: "Entradas" }
                ]}
              />
            </div>
          </div>
          
          {/* Período Específico */}
          <div className="filters__row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", gap: 6, background: "rgba(13,17,23,0.8)", border: "1.5px solid var(--border)", borderRadius: "var(--r-sm)", padding: "4px 8px" }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DE:</span>
              <input 
                type="date" 
                style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', flex: 1, fontSize: '13px' }}
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
            </div>
            <div style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", gap: 6, background: "rgba(13,17,23,0.8)", border: "1.5px solid var(--border)", borderRadius: "var(--r-sm)", padding: "4px 8px" }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ATÉ:</span>
              <input 
                type="date" 
                style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', flex: 1, fontSize: '13px' }}
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
            </div>
          </div>
          <div className="filters__row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <MultiSelect
                label="Cartões"
                value={filterCartao}
                onChange={setFilterCartao}
                options={cards.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <MultiSelect
                label="Formas de pag."
                value={filterForma}
                onChange={setFilterForma}
                options={PAYMENT_METHODS.map(m => ({ value: m.key, label: `${m.icon} ${m.label}` }))}
              />
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
      {filterMonth.length === 1 && faturaMes !== null && (
        <div className="paper">
          <div className="paper__inner">
            <p className="paper__label">Fatura estimada · {monthLabel(filterMonth[0])}</p>
            <p className="paper__value">{formatBRL(faturaMes)}</p>
            <p className="paper__foot">Soma das parcelas que vencem neste mês, incluindo compras de meses anteriores</p>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>
            Lançamentos ({filtered.length})
          </p>
          {filtered.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {totalReceitas > 0 && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--sage)" }}>
                  +{formatBRL(totalReceitas)}
                </span>
              )}
              {totalCompras > 0 && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--rust)" }}>
                  -{formatBRL(totalCompras)}
                </span>
              )}
            </div>
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
                      <span className="list-row__value" style={{ color: e.tipo === "receita" ? "var(--sage)" : "var(--rust)" }}>
                        {e.tipo === "receita" ? "+" : "-"}{formatBRL(e.valor)}
                      </span>
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
