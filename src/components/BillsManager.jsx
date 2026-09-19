import { useState, useMemo } from "react";
import { formatBRL, currentMonthKey, todayISO, maskCurrency, currencyToNumber, monthLabel, shiftMonthKey } from "../utils/format";
import { PAYMENT_METHODS } from "../constants";
import { Check, Clock, AlertCircle, Plus, X, ChevronLeft, ChevronRight, Edit3 } from "lucide-react";
import HelpIcon from "./HelpIcon";

export default function BillsManager({ bills, addBill, updateBill, deleteBill, categories, addExpense }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Payment modal states
  const [payingBill, setPayingBill] = useState(null);
  const [payMethod, setPayMethod] = useState("pix");

  // Form states
  const [descricao, setDescricao] = useState("");
  const [valorMasked, setValorMasked] = useState("");
  const [categoria, setCategoria] = useState(categories.find(c => c.tipo !== "receita")?.key || "");
  const [isRecurring, setIsRecurring] = useState(true);
  const [diaVencimento, setDiaVencimento] = useState(10);
  
  const [curKey, setCurKey] = useState(currentMonthKey()); // YYYY-MM
  const [selectedMonths, setSelectedMonths] = useState([curKey]);
  const [editFromNowOn, setEditFromNowOn] = useState(true);
  const todayDate = new Date();
  
  const next12Months = useMemo(() => {
    const list = [];
    let k = curKey; 
    for (let i = 0; i < 12; i++) {
      list.push(k);
      k = shiftMonthKey(k, 1);
    }
    return list;
  }, [curKey]);

  // Computed bills for the current month
  const currentMonthBills = useMemo(() => {
    return bills.map(bill => {
      let isPaid = false;
      let dueDateStr = "";
      
      if (bill.isRecurring) {
        isPaid = (bill.paidMonths || []).includes(curKey);
        dueDateStr = `${curKey}-${String(bill.diaVencimento).padStart(2, "0")}`;
      } else {
        isPaid = bill.paid === true;
        dueDateStr = bill.dataVencimento;
      }
      
      let status = "upcoming";
      if (isPaid) {
        status = "paid";
      } else {
        const due = new Date(`${dueDateStr}T23:59:59`);
        if (due < todayDate) {
          status = "overdue";
        }
      }
      
      return { ...bill, isPaid, dueDateStr, status };
    }).filter(bill => {
      if (bill.isRecurring) {
        if (bill.startMonth && curKey < bill.startMonth) return false;
        if (bill.endMonth && curKey > bill.endMonth) return false;
        return true;
      }
      if (bill.status === "overdue" && !bill.isPaid) return true;
      return bill.dueDateStr.startsWith(curKey);
    }).sort((a, b) => a.dueDateStr.localeCompare(b.dueDateStr));
  }, [bills, curKey, todayDate]);

  const overdueBills = currentMonthBills.filter(b => b.status === "overdue");
  const upcomingBills = currentMonthBills.filter(b => b.status === "upcoming");
  const paidBills = currentMonthBills.filter(b => b.status === "paid");

  function resetForm() {
    setDescricao("");
    setValorMasked("");
    setIsRecurring(true);
    setDiaVencimento(10);
    setSelectedMonths([curKey]);
    setEditFromNowOn(true);
    setEditingId(null);
    setShowForm(false);
  }

  const originalBill = bills.find(b => b.id === editingId);

  function handleSave() {
    const valor = currencyToNumber(valorMasked);
    if (!descricao.trim() || valor <= 0) return alert("Preencha descrição e valor corretamente.");
    if (!isRecurring && selectedMonths.length === 0) return alert("Selecione pelo menos um mês.");

    const payload = {
      descricao,
      valor,
      categoria,
      isRecurring,
    };
    
    if (editingId) {
      if (isRecurring) {
        payload.diaVencimento = Number(diaVencimento);
        if (editFromNowOn && originalBill?.isRecurring) {
          updateBill(editingId, { endMonth: shiftMonthKey(curKey, -1) });
          const futurePaid = (originalBill.paidMonths || []).filter(m => m >= curKey);
          addBill({ ...payload, startMonth: curKey, paidMonths: futurePaid });
        } else {
          updateBill(editingId, payload);
        }
      } else {
        payload.dataVencimento = `${selectedMonths[0]}-${String(diaVencimento).padStart(2, "0")}`;
        updateBill(editingId, payload);
        
        for (let i = 1; i < selectedMonths.length; i++) {
           addBill({
             ...payload,
             dataVencimento: `${selectedMonths[i]}-${String(diaVencimento).padStart(2, "0")}`,
             paid: false
           });
        }
      }
    } else {
      if (isRecurring) {
        payload.diaVencimento = Number(diaVencimento);
        payload.startMonth = curKey;
        payload.paidMonths = [];
        addBill(payload);
      } else {
        selectedMonths.forEach(mk => {
           addBill({
             ...payload,
             dataVencimento: `${mk}-${String(diaVencimento).padStart(2, "0")}`,
             paid: false
           });
        });
      }
    }
    resetForm();
  }

  function handleMarkAsPaid(bill) {
    setPayingBill(bill);
    setPayMethod("pix"); // default
  }

  function confirmPay() {
    if (!payingBill) return;

    addExpense({
      descricao: payingBill.descricao,
      valor: payingBill.valor,
      data: payingBill.dueDateStr,
      categoria: payingBill.categoria,
      tipo: "despesa",
      isRecurring: false,
      formaPagamento: payMethod,
      parcelas: 1,
      cartao: null
    });

    if (payingBill.isRecurring) {
      updateBill(payingBill.id, { paidMonths: [...(payingBill.paidMonths || []), curKey] });
    } else {
      updateBill(payingBill.id, { paid: true });
    }
    
    setPayingBill(null);
  }

  function handleDelete(bill) {
    if (confirm(`Deseja realmente excluir '${bill.descricao}'?`)) {
      deleteBill(bill.id);
    }
  }

  function handleEdit(bill) {
    setEditingId(bill.id);
    setDescricao(bill.descricao);
    setValorMasked(maskCurrency(bill.valor.toFixed(2)));
    setCategoria(bill.categoria);
    setIsRecurring(bill.isRecurring || false);
    setEditFromNowOn(true);
    
    if (bill.isRecurring) {
      setDiaVencimento(bill.diaVencimento);
      setSelectedMonths([curKey]);
    } else {
      const pts = bill.dataVencimento.split("-");
      setDiaVencimento(Number(pts[2]));
      setSelectedMonths([`${pts[0]}-${pts[1]}`]);
    }
    setShowForm(true);
  }

  const { totalBillsMonth, totalPaidMonth, totalRemainingMonth } = useMemo(() => {
    let total = 0;
    let paid = 0;
    let remaining = 0;
    currentMonthBills.forEach(bill => {
      total += bill.valor;
      if (bill.isPaid) {
        paid += bill.valor;
      } else {
        remaining += bill.valor;
      }
    });
    return { totalBillsMonth: total, totalPaidMonth: paid, totalRemainingMonth: remaining };
  }, [currentMonthBills]);

  return (
    <div className="tab-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Month Navigator */}
      {!showForm && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button className="icon-btn" onClick={() => setCurKey(shiftMonthKey(curKey, -1))}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{monthLabel(curKey)}</div>
          <button className="icon-btn" onClick={() => setCurKey(shiftMonthKey(curKey, 1))}>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
            Contas a Pagar
            <HelpIcon text="Aqui você cadastra contas pontuais ou recorrentes (fixas). O sistema projetará as contas mensais fixas automaticamente para os próximos meses." />
          </h2>
          {!showForm && currentMonthBills.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Total: <strong style={{ color: "var(--text)" }}>{formatBRL(totalBillsMonth)}</strong></span>
              <span>Pago: <strong style={{ color: "var(--sage)" }}>{formatBRL(totalPaidMonth)}</strong></span>
              <span>Falta pagar: <strong style={{ color: "var(--gold)" }}>{formatBRL(totalRemainingMonth)}</strong></span>
            </div>
          )}
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ padding: "8px 12px", fontSize: 13, width: "auto", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
            <Plus size={16} /> Nova Conta
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <p className="section-title">{editingId ? "Editar Conta" : "Nova Conta"}</p>
            <button className="icon-btn" onClick={resetForm}><X size={20} /></button>
          </div>
          
          <div className="form-group">
            <label className="label">Descrição</label>
            <input className="input" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Faculdade" />
          </div>
          
          <div className="form-group">
            <label className="label">Valor</label>
            <input className="input" inputMode="numeric" value={valorMasked} onChange={e => setValorMasked(maskCurrency(e.target.value))} placeholder="R$ 0,00" />
          </div>

          <div className="form-group">
            <label className="label">Categoria</label>
            <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {categories.filter(c => c.tipo !== "receita").map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 16, marginTop: 12 }}>
            <div 
              onClick={() => setIsRecurring(!isRecurring)}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                padding: "14px 16px",
                background: isRecurring ? "rgba(230,180,74,0.1)" : "var(--bg-card)",
                border: `1px solid ${isRecurring ? "rgba(230,180,74,0.4)" : "var(--border)"}`,
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ 
                  width: 20, height: 20, 
                  borderRadius: 6, 
                  background: isRecurring ? "var(--gold)" : "transparent",
                  border: `2px solid ${isRecurring ? "var(--gold)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s ease"
                }}>
                  {isRecurring && <Check size={14} color="#1A1000" strokeWidth={4} />}
                </div>
                <span style={{ fontSize: 14, fontWeight: isRecurring ? 600 : 400, color: isRecurring ? "var(--gold)" : "var(--text)" }}>
                  Conta mensal fixa (recorrente)
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Dia do Vencimento (1 a 31)</label>
            <input className="input" type="number" min={1} max={31} value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} />
          </div>

          {!isRecurring && (
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="label" style={{ marginBottom: 8 }}>
                {editingId ? "Repetir nestes meses (seleção múltipla)" : "Repetir nestes meses (seleção múltipla)"}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {next12Months.map(mk => (
                  <div 
                    key={mk}
                    onClick={() => {
                      if (selectedMonths.includes(mk)) {
                        setSelectedMonths(selectedMonths.filter(m => m !== mk));
                      } else {
                        setSelectedMonths([...selectedMonths, mk]);
                      }
                    }}
                    style={{
                      padding: "8px", textAlign: "center", fontSize: 12, borderRadius: 6, cursor: "pointer",
                      background: selectedMonths.includes(mk) ? "rgba(61, 214, 140, 0.15)" : "var(--bg-hover)",
                      color: selectedMonths.includes(mk) ? "var(--sage)" : "var(--text-muted)",
                      border: `1px solid ${selectedMonths.includes(mk) ? "var(--sage)" : "var(--border)"}`
                    }}
                  >
                    {monthLabel(mk)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isRecurring && editingId && (
             <div className="form-group" style={{ marginTop: 16, padding: 12, background: "rgba(91, 141, 239, 0.08)", border: "1px solid rgba(91, 141, 239, 0.2)", borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "var(--blue)" }}>
                  <input type="checkbox" checked={editFromNowOn} onChange={e => setEditFromNowOn(e.target.checked)} style={{ width: 16, height: 16 }} />
                  Aplicar novo valor apenas a partir deste mês ({monthLabel(curKey)})
                </label>
             </div>
          )}

          <button className="btn-primary" onClick={handleSave} style={{ width: "100%", marginTop: 8 }}>
            Salvar Conta
          </button>
        </div>
      )}

      {!showForm && currentMonthBills.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <p>Você não tem nenhuma conta cadastrada.</p>
        </div>
      )}

      {!showForm && overdueBills.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ color: "var(--rust)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} /> Atrasadas
            <HelpIcon text="Contas com o prazo de vencimento ultrapassado que ainda não foram marcadas como pagas." />
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {overdueBills.map(b => (
              <BillRow key={b.id} bill={b} onPay={() => handleMarkAsPaid(b)} onDelete={() => handleDelete(b)} onEdit={() => handleEdit(b)} />
            ))}
          </div>
        </div>
      )}

      {!showForm && upcomingBills.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={16} /> Próximas a vencer
            <HelpIcon text="Contas que vão vencer em breve." />
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcomingBills.map(b => (
              <BillRow key={b.id} bill={b} onPay={() => handleMarkAsPaid(b)} onDelete={() => handleDelete(b)} onEdit={() => handleEdit(b)} />
            ))}
          </div>
        </div>
      )}

      {!showForm && paidBills.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ color: "var(--sage)", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={16} /> Pagas neste mês
            <HelpIcon text="Contas que você já pagou este mês." />
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {paidBills.map(b => (
              <BillRow key={b.id} bill={b} onPay={null} isPaid onDelete={() => handleDelete(b)} onEdit={() => handleEdit(b)} />
            ))}
          </div>
        </div>
      )}

      {payingBill && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: 12, color: "var(--text)" }}>Marcar como paga</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Deseja marcar <strong>{payingBill.descricao}</strong> como paga e lançar no seu relatório financeiro?
            </p>
            
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="label">Forma de Pagamento</label>
              <div className="radio-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PAYMENT_METHODS.filter(m => m.key !== "credito").map(m => (
                  <button
                    key={m.key}
                    type="button"
                    className={`radio-btn ${payMethod === m.key ? "active" : ""}`}
                    onClick={() => setPayMethod(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setPayingBill(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmPay} style={{ background: "var(--sage)", color: "#111" }}>
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillRow({ bill, onPay, isPaid, onDelete, onEdit }) {
  const parts = bill.dueDateStr.split("-");
  const displayDate = `${parts[2]}/${parts[1]}`;
  
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px", background: "var(--overlay-white)", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ minWidth: 120, flex: "1 1 auto" }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: isPaid ? "var(--text-muted)" : "var(--text)", textDecoration: isPaid ? "line-through" : "none" }}>
          {bill.descricao}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          Vence em: {displayDate} {bill.isRecurring ? "(Mensal)" : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: isPaid ? "var(--text-muted)" : "var(--text)", marginRight: 4 }}>
          {formatBRL(bill.valor)}
        </span>
        {!isPaid && (
          <button 
            onClick={onPay}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(61, 214, 140, 0.15)", color: "var(--sage)", border: "none", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <Check size={14} /> Pagar
          </button>
        )}
        <button onClick={onEdit} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }} title="Editar">
          <Edit3 size={14} />
        </button>
        <button onClick={onDelete} style={{ background: "transparent", border: "none", color: "var(--rust)", cursor: "pointer", padding: "4px" }} title="Excluir">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
