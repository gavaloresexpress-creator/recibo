import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, CreditCard, Eye, EyeOff } from "lucide-react";
import { INSTALLMENT_OPTIONS, PAYMENT_METHODS } from "../constants";
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

export default function ExpenseForm({ cards, categories, expenses, onAdd, onAddCard, addCategory, deleteCategory, onSaved, initialExpense, onCancelEdit }) {
  const [valorMasked, setValorMasked] = useState("");
  const [data, setData]               = useState(todayISO());
  const [descricao, setDescricao]     = useState("");
  const [notas, setNotas]             = useState("");
  const [categoria, setCategoria]     = useState(categories[0]?.key || "");
  const [cartao, setCartao]           = useState(cards[0] || "");
  const [parcelas, setParcelas]       = useState(1);
  const [mesInicioParcelas, setMesInicioParcelas] = useState(() => {
    // Default: próximo mês
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard]         = useState("");
  const [errors, setErrors]           = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [tipo, setTipo]               = useState("despesa");
  const [formaPagamento, setFormaPagamento] = useState("credito");
  const [showAddCat, setShowAddCat]   = useState(false);
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon]   = useState("");
  const [newCatColor, setNewCatColor] = useState("#8B5CF6");

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
      setIsRecurring(initialExpense.isRecurring || false);
      setTipo(initialExpense.tipo || "despesa");
      setFormaPagamento(initialExpense.formaPagamento || "credito");
      setMesInicioParcelas(initialExpense.mesInicioParcelas || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })());
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
    if (formaPagamento === "credito" && !cartao) errs.cartao = "Selecione um cartão.";
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
      tipo,
      cartao: formaPagamento === "credito" && tipo === "despesa" ? cartao : null,
      isRecurring,
      parcelas: (formaPagamento === "credito" && !isRecurring && tipo === "despesa") ? parcelasNum : 1,
      formaPagamento,
      mesInicioParcelas: formaPagamento === "credito" && parcelasNum > 1 && !isRecurring && tipo === "despesa" ? mesInicioParcelas : null,
    });
    // Reset
    setValorMasked("");
    setDescricao("");
    setNotas("");
    setParcelas(1);
    setIsRecurring(false);
    setFormaPagamento("credito");
    setData(todayISO());
    setErrors({});
    setShowPreview(false);
    // Reset mesInicioParcelas to next month
    const nd = new Date();
    nd.setMonth(nd.getMonth() + 1);
    setMesInicioParcelas(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`);
    onSaved();
  }

  function handleAddCard() {
    if (!newCard.trim()) return;
    onAddCard(newCard.trim());
    setCartao(newCard.trim());
    setNewCard("");
    setShowAddCard(false);
  }

  const selCat = categories.find((c) => c.key === categoria);

  return (
    <div className="card tab-enter">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>
          {initialExpense ? "Editar lançamento" : "Novo lançamento"}
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

      {/* Tipo Toggle (Despesa / Receita) */}
      {!initialExpense && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            style={{
              flex: 1, padding: "10px", borderRadius: "10px", fontWeight: 600, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: tipo === "despesa" ? "rgba(230, 82, 82, 0.15)" : "var(--bg-hover)",
              border: `1px solid ${tipo === "despesa" ? "var(--rust)" : "var(--border)"}`,
              color: tipo === "despesa" ? "var(--rust)" : "var(--text-muted)",
              transition: "all 0.2s"
            }}
            onClick={() => {
              setTipo("despesa");
              setCategoria(categories.find(c => c.tipo !== "receita")?.key || "");
              setFormaPagamento("credito");
            }}
          >
            <span style={{ fontSize: 16 }}>🔴</span> Nova Despesa
          </button>
          <button
            type="button"
            style={{
              flex: 1, padding: "10px", borderRadius: "10px", fontWeight: 600, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: tipo === "receita" ? "rgba(61, 214, 140, 0.15)" : "var(--bg-hover)",
              border: `1px solid ${tipo === "receita" ? "var(--sage)" : "var(--border)"}`,
              color: tipo === "receita" ? "var(--sage)" : "var(--text-muted)",
              transition: "all 0.2s"
            }}
            onClick={() => {
              setTipo("receita");
              setCategoria(categories.find(c => c.tipo === "receita")?.key || "");
              setFormaPagamento("pix"); // Default para receita
            }}
          >
            <span style={{ fontSize: 16 }}>🟢</span> Nova Receita
          </button>
        </div>
      )}

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
            {formaPagamento === "credito" ? (
              <span>💳 {cartao}{isRecurring ? " · 🔄 Recorrente" : (parcelasNum > 1 ? ` · ${parcelasNum}x de ${formatBRL(valorParcela)}` : "")}</span>
            ) : (
              <span>{PAYMENT_METHODS.find(p => p.key === formaPagamento)?.icon} {PAYMENT_METHODS.find(p => p.key === formaPagamento)?.label}{isRecurring ? " · 🔄 Recorrente" : ""}</span>
            )}
            <span>🏷️ {selCat?.label}</span>
          </div>
        </div>
      )}

      {/* Forma de pagamento */}
      <div className="field">
        <label className="field__label">
          {tipo === "receita" ? "Forma de recebimento" : "Forma de pagamento"}
        </label>
        <div className="chip-grid">
          {PAYMENT_METHODS.filter(m => tipo === "despesa" || m.key !== "credito").map((m) => (
            <button
              key={m.key}
              type="button"
              className={`chip${formaPagamento === m.key ? " active" : ""}`}
              onClick={() => setFormaPagamento(m.key)}
              style={formaPagamento === m.key ? { borderColor: m.color, color: m.color } : {}}
              aria-pressed={formaPagamento === m.key}
            >
              <span className="chip__icon">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

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
          <label className="field__label" htmlFor="campo-data">
            {tipo === "receita" ? "Data do recebimento" : "Data da compra"}
          </label>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label className="field__label" style={{ marginBottom: 0 }}>Categoria</label>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }} onClick={() => setIsEditingCategories(!isEditingCategories)}>
              {isEditingCategories ? "Concluído" : "Apagar..."}
            </button>
            <button type="button" style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12, cursor: "pointer" }} onClick={() => setShowAddCat(!showAddCat)}>
              {showAddCat ? "Cancelar" : "+ Nova"}
            </button>
          </div>
        </div>

        {showAddCat && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.1)", borderRadius: 8, marginBottom: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input className="input" placeholder="Nome (Ex: Pet)" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} style={{ flex: 1 }} />
              <input className="input" placeholder="Ícone (Ex: 🐶)" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} style={{ width: 90 }} />
              <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width: 44, height: 44, padding: 0, border: "none", borderRadius: 8, cursor: "pointer", background: "none" }} title="Cor da categoria" />
            </div>
            <button type="button" className="btn-primary" style={{ padding: "8px 12px", fontSize: 12, width: "100%" }} onClick={() => {
              if (newCatLabel.trim()) {
                const key = newCatLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + Date.now();
                addCategory({ key, label: newCatLabel.trim(), icon: newCatIcon || "🏷️", color: newCatColor, tipo });
                setShowAddCat(false);
                setNewCatLabel("");
                setNewCatIcon("");
                setCategoria(key);
              }
            }}>Salvar Categoria</button>
          </div>
        )}

        <div className="chip-grid">
          {categories.filter(c => (tipo === "receita" ? c.tipo === "receita" : c.tipo !== "receita")).map((c) => (
            <div key={c.key} style={{ position: "relative" }}>
              <button
                type="button"
                className={`chip${categoria === c.key ? " active" : ""}`}
                onClick={() => {
                  if (isEditingCategories) {
                    if (window.confirm(`Tem certeza que deseja apagar a categoria ${c.label}?`)) {
                      deleteCategory(c.key);
                      if (categoria === c.key) setCategoria(categories[0]?.key);
                    }
                  } else {
                    setCategoria(c.key);
                  }
                }}
                style={isEditingCategories ? { border: "1px dashed var(--rust)", opacity: 0.8, color: "var(--rust)" } : {}}
                aria-pressed={categoria === c.key}
              >
                <span className="chip__icon">{c.icon}</span>
                {c.label}
              </button>
              {isEditingCategories && (
                <div style={{ position: "absolute", top: -5, right: -5, background: "var(--rust)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <X size={10} strokeWidth={3} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cartão — só no crédito */}
      {formaPagamento === "credito" && (
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
      )}

      {/* Recorrente Toggle (Premium) */}
      <div className="field">
        <div 
          onClick={() => setIsRecurring(!isRecurring)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderRadius: "12px", cursor: "pointer",
            background: isRecurring ? "var(--gold-glow)" : "var(--bg-elev)",
            border: `1px solid ${isRecurring ? "var(--gold)" : "var(--border)"}`,
            transition: "all 0.2s ease",
            marginTop: 4
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🔄</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: isRecurring ? "var(--gold)" : "var(--text)" }}>
                Despesa Recorrente
              </span>
              <span style={{ fontSize: 12, color: isRecurring ? "var(--gold)" : "var(--text-muted)", opacity: 0.8 }}>
                Repetir todos os meses (ex: assinaturas)
              </span>
            </div>
          </div>
          {/* Switch UI */}
          <div style={{
            width: 40, height: 24, borderRadius: 12,
            background: isRecurring ? "var(--gold)" : "var(--bg)",
            border: `1px solid ${isRecurring ? "var(--gold)" : "var(--border-lg)"}`,
            position: "relative", transition: "all 0.2s ease"
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", 
              background: isRecurring ? "var(--bg)" : "var(--text-muted)",
              position: "absolute", top: 2, left: isRecurring ? 18 : 2,
              transition: "all 0.2s ease", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }} />
          </div>
        </div>
      </div>

      {/* Parcelas — só no crédito e NÃO recorrente */}
      {formaPagamento === "credito" && !isRecurring && (
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
      )}

      {/* Mês da 1ª parcela (só no crédito parcelado e não recorrente) */}
      {formaPagamento === "credito" && parcelasNum > 1 && !isRecurring && (
        <div className="field">
          <label className="field__label" htmlFor="campo-mes-inicio">
            1ª parcela em
            <span style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: 11, marginLeft: 6 }}>
              Ajuste se a fatura já fechou
            </span>
          </label>
          <input
            id="campo-mes-inicio"
            type="month"
            className="input"
            value={mesInicioParcelas}
            onChange={(e) => setMesInicioParcelas(e.target.value)}
            style={{ fontSize: 14 }}
            aria-label="Mês da primeira parcela"
          />
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5, lineHeight: 1.5 }}>
            Compra parcelada em {parcelasNum}x: parcelas em{" "}
            {Array.from({ length: parcelasNum }, (_, i) => {
              if (!mesInicioParcelas) return null;
              const [y, m] = mesInicioParcelas.split("-").map(Number);
              const d = new Date(y, m - 1 + i, 1);
              return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
            }).join(", ")}
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button
          type="button"
          id="btn-salvar-gasto"
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={handleSubmit}
        >
          {initialExpense ? "Salvar alterações" : (tipo === "receita" ? "Salvar recebimento" : "Salvar gasto")}
        </button>
        {initialExpense && (
          <button
            type="button"
            style={{ 
              flex: 1, 
              padding: "16px", 
              background: "var(--bg-hover)", 
              borderRadius: "var(--r-md)", 
              color: "var(--text)", 
              border: "1px solid var(--border-lg)",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onClick={onCancelEdit}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
