import { useState, useMemo } from "react";
import { formatBRL, currentMonthKey, todayISO, maskCurrency, currencyToNumber, monthLabel, shiftMonthKey } from "../utils/format";
import { Check, Clock, AlertCircle, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";

export default function BillsManager({ bills, addBill, updateBill, deleteBill, categories, addExpense }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [descricao, setDescricao] = useState("");
  const [valorMasked, setValorMasked] = useState("");
  const [categoria, setCategoria] = useState(categories.find(c => c.tipo !== "receita")?.key || "");
  const [isRecurring, setIsRecurring] = useState(true);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [dataVencimento, setDataVencimento] = useState(todayISO());

  const [curKey, setCurKey] = useState(currentMonthKey()); // YYYY-MM
  const todayDate = new Date();
  
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
    setDataVencimento(todayISO());
    setEditingId(null);
    setShowForm(false);
  }

  function handleSave() {
    const valor = currencyToNumber(valorMasked);
    if (!descricao.trim() || valor <= 0) return alert("Preencha descrição e valor corretamente.");

    const payload = {
      descricao,
      valor,
      categoria,
      isRecurring,
    };
    
    if (isRecurring) {
      payload.diaVencimento = Number(diaVencimento);
    } else {
      payload.dataVencimento = dataVencimento;
      payload.paid = false;
    }

    if (editingId) {
      updateBill(editingId, payload);
    } else {
      if (isRecurring) {
        payload.startMonth = curKey;
        payload.paidMonths = [];
      }
      addBill(payload);
    }
    resetForm();
  }

  function handleMarkAsPaid(bill) {
    const launchExpense = confirm(`Deseja lançar o pagamento de '${bill.descricao}' no seu relatório financeiro?\n\n(OK = Lançar e descontar do orçamento\nCancelar = Apenas riscar da agenda)`);
    
    if (launchExpense) {
      addExpense({
        descricao: bill.descricao,
        valor: bill.valor,
        data: bill.dueDateStr,
        categoria: bill.categoria,
        tipo: "despesa",
        isRecurring: false,
        formaPagamento: "dinheiro",
        parcelas: 1,
        cartao: null
      });
    }

    if (bill.isRecurring) {
      updateBill(bill.id, { paidMonths: [...(bill.paidMonths || []), curKey] });
    } else {
      updateBill(bill.id, { paid: true });
    }
  }

  function handleDelete(bill) {
    if (confirm(`Deseja realmente excluir '${bill.descricao}'?`)) {
      deleteBill(bill.id);
    }
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
          <h2 style={{ fontSize: 18, fontWeight: 600, whiteSpace: "nowrap" }}>Contas a Pagar</h2>
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

          <div className="form-group" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
            <input type="checkbox" id="recur" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
            <label htmlFor="recur" style={{ fontSize: 14 }}>Conta mensal fixa (recorrente)</label>
          </div>

          {isRecurring ? (
            <div className="form-group">
              <label className="label">Dia do Vencimento (1 a 31)</label>
              <input className="input" type="number" min={1} max={31} value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} />
            </div>
          ) : (
            <div className="form-group">
              <label className="label">Data de Vencimento</label>
              <input className="input" type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
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
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {overdueBills.map(b => (
              <BillRow key={b.id} bill={b} onPay={() => handleMarkAsPaid(b)} onDelete={() => handleDelete(b)} />
            ))}
          </div>
        </div>
      )}

      {!showForm && upcomingBills.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={16} /> Próximas a vencer
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcomingBills.map(b => (
              <BillRow key={b.id} bill={b} onPay={() => handleMarkAsPaid(b)} onDelete={() => handleDelete(b)} />
            ))}
          </div>
        </div>
      )}

      {!showForm && paidBills.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ color: "var(--sage)", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={16} /> Pagas neste mês
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {paidBills.map(b => (
              <BillRow key={b.id} bill={b} onPay={null} isPaid onDelete={() => handleDelete(b)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BillRow({ bill, onPay, isPaid, onDelete }) {
  const parts = bill.dueDateStr.split("-");
  const displayDate = `${parts[2]}/${parts[1]}`;
  
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 15, color: isPaid ? "var(--text-muted)" : "var(--text)", textDecoration: isPaid ? "line-through" : "none" }}>
          {bill.descricao}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          Vence em: {displayDate} {bill.isRecurring ? "(Mensal)" : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        <button onClick={onDelete} style={{ background: "transparent", border: "none", color: "var(--rust)", cursor: "pointer", padding: "4px" }} title="Excluir">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
