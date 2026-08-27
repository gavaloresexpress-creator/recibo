import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, CreditCard, Eye, EyeOff } from "lucide-react";
import { CATEGORIES, INSTALLMENT_OPTIONS } from "../constants";
import {
  todayISO, formatBRL, maskCurrency, currencyToNumber,
} from "../utils/format";

function AutocompleteInput({ value, onChange, suggestions, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = suggestions
    .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    .slice(0, 6);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="autocomplete" ref={ref}>
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="autocomplete__list">
          {filtered.map((s) => (
            <div
              key={s}
              className="autocomplete__item"
              onMouseDown={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExpenseForm({ cards, expenses, onAdd, onAddCard, onSaved, initialExpense, onCancelEdit }) {
  const [valorMasked, setValorMasked] = useState("");
  const [data, setData]               = useState(todayISO());
  const [descricao, setDescricao]     = useState("");
  const [notas, setNotas]             = useState("");
  const [categoria, setCategoria]     = useState(CATEGORIES[0].key);
  const [cartao, setCartao]           = useState(cards[0] || "");
  const [parcelas, setParcelas]       = useState(1);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard]         = useState("");
  const [errors, setErrors]           = useState({});
  const [showPreview, setShowPreview] = useState(false);

  // Histórico de descrições para autocomplete
  const descHistory = [...new Set(expenses.map((e) => e.descricao))];

  useEffect(() => {
    if (initialExpense) {
      setValorMasked(maskCurrency(Math.round(initialExpense.valor * 100).toString()));
      setData(initialExpense.data);
      setDescricao(initialExpense.descricao);
      setNotas(initialExpense.notas || "");
      setCategoria(initialExpense.categoria);
      setCartao(initialExpense.cartao);
      setParcelas(initialExpense.parcelas);
    }
  }, [initialExpense]);

  useEffect(() => {
    if (!cartao && cards.length && !initialExpense) setCartao(cards[0]);
  }, [cards, cartao, initialExpense]);

  const valor = currencyToNumber(valorMasked);
  const parcelasNum = Math.max(1, Number(parcelas) || 1);
  const valorParcela = valor > 0 ? valor / parcelasNum : 0;

  const handleValorChange = useCallback((e) => {
    setValorMasked(maskCurrency(e.target.value));
  }, []);

  function validate() {
    const errs = {};
    if (valor <= 0) errs.valor = "Informe um valor válido.";
    if (!descricao.trim()) errs.descricao = "Informe uma descrição.";
    if (!data) errs.data = "Informe a data da compra.";
    if (!cartao) errs.cartao = "Selecione um cartão.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onAdd({
      valor,
      data,
      descricao: descricao.trim(),
      notas: notas.trim(),
      categoria,
      cartao,
      parcelas: parcelasNum,
    });
    // Reset
    setValorMasked("");
    setDescricao("");
    setNotas("");
    setParcelas(1);
    setData(todayISO());
    setErrors({});
    setShowPreview(false);
    onSaved();
  }

  function handleAddCard() {
    if (!newCard.trim()) return;
    onAddCard(newCard.trim());
    setCartao(newCard.trim());
    setNewCard("");
    setShowAddCard(false);
  }

  const selCat = CATEGORIES.find((c) => c.key === categoria);

  return (
    <div className="card tab-enter">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>
          {initialExpense ? "Editar gasto" : "Novo gasto"}
        </p>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "none", border: "none",
            color: "var(--text-muted)", fontSize: 12,
            transition: "color var(--t)"
          }}
        >
          {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          {showPreview ? "Ocultar" : "Preview"}
        </button>
      </div>

      {/* Preview Card */}
      {showPreview && valor > 0 && (
        <div style={{
          background: "var(--gold-glow)",
          border: "1px solid rgba(230,180,74,0.2)",
          borderRadius: "var(--r-sm)",
          padding: "12px 14px",
          marginBottom: 16,
          fontSize: 13,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{selCat?.icon}</span>
            <span style={{ color: "var(--text)", fontWeight: 600, flex: 1 }}>
              {descricao || "(sem descrição)"}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gold)", fontWeight: 700 }}>
              {formatBRL(valor)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)" }}>
            <span>📅 {data}</span>
            <span>💳 {cartao}</span>
            <span>🏷️ {selCat?.label}</span>
            {parcelasNum > 1 && <span>📆 {parcelasNum}x de {formatBRL(valorParcela)}</span>}
          </div>
        </div>
      )}

      {/* Valor + Data */}
      <div className="row">
        <div className="field">
          <label className="field__label" htmlFor="campo-valor">Valor (R$)</label>
          <input
            id="campo-valor"
            className={`input${errors.valor ? " input--error" : valor > 0 ? " input--success" : ""}`}
            inputMode="numeric"
            placeholder="0,00"
            value={valorMasked}
            onChange={handleValorChange}
          />
          {errors.valor && <span className="field__error">{errors.valor}</span>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="campo-data">Data da compra</label>
          <input
            id="campo-data"
            className={`input${errors.data ? " input--error" : ""}`}
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
          {errors.data && <span className="field__error">{errors.data}</span>}
        </div>
      </div>

      {/* Descrição com autocomplete */}
      <div className="field">
        <label className="field__label" htmlFor="campo-desc">Descrição</label>
        <AutocompleteInput
          value={descricao}
          onChange={setDescricao}
          suggestions={descHistory}
          placeholder="Ex: Supermercado, iFood, Farmácia..."
          className={`input${errors.descricao ? " input--error" : descricao.trim() ? " input--success" : ""}`}
        />
        {errors.descricao && <span className="field__error">{errors.descricao}</span>}
      </div>

      {/* Notas */}
      <div className="field">
        <label className="field__label" htmlFor="campo-notas">Notas (opcional)</label>
        <textarea
          id="campo-notas"
          className="input textarea"
          placeholder="Observações adicionais..."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
        />
      </div>

      {/* Categoria */}
      <div className="field">
        <label className="field__label">Categoria</label>
        <div className="chip-grid">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip${categoria === c.key ? " active" : ""}`}
              onClick={() => setCategoria(c.key)}
              aria-pressed={categoria === c.key}
            >
              <span className="chip__icon">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cartão */}
      <div className="field">
        <label className="field__label">
          <CreditCard size={13} /> Cartão utilizado
        </label>
        {!showAddCard ? (
          <div className="card-row">
            <select
              className={`select${errors.cartao ? " input--error" : ""}`}
              value={cartao}
              onChange={(e) => setCartao(e.target.value)}
              aria-label="Selecionar cartão"
            >
              {cards.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowAddCard(true)}
              aria-label="Adicionar novo cartão"
            >
              <Plus size={18} />
            </button>
          </div>
        ) : (
          <div className="card-row">
            <input
              className="input"
              placeholder="Nome do novo cartão"
              value={newCard}
              onChange={(e) => setNewCard(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCard()}
              autoFocus
            />
            <button type="button" className="icon-btn" onClick={handleAddCard} aria-label="Confirmar cartão">
              <Plus size={18} />
            </button>
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => setShowAddCard(false)} aria-label="Cancelar">
              <X size={18} />
            </button>
          </div>
        )}
        {errors.cartao && <span className="field__error">{errors.cartao}</span>}
      </div>

      {/* Parcelas */}
      <div className="field">
        <label className="field__label" htmlFor="campo-parcelas">Número de parcelas</label>
        <select
          id="campo-parcelas"
          className="select"
          value={parcelas}
          onChange={(e) => setParcelas(e.target.value)}
        >
          {INSTALLMENT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x`}</option>
          ))}
        </select>

        {parcelasNum > 1 && valor > 0 && (
          <div className="installment-preview">
            <span className="installment-preview__label">Valor por parcela</span>
            <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatBRL(valorParcela)}</strong>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          id="btn-salvar-gasto"
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={handleSubmit}
        >
          {initialExpense ? "Salvar alterações" : "Salvar gasto"}
        </button>
        {initialExpense && (
          <button
            type="button"
            className="del-btn"
            style={{ padding: "0 16px", background: "rgba(255,255,255,0.05)", borderRadius: "var(--r-md)", color: "var(--text)" }}
            onClick={onCancelEdit}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
