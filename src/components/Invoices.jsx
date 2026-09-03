import { useState, useMemo } from "react";
import { formatBRL, currentMonthKey, monthLabel, shiftMonthKey, getInstallmentEntries } from "../utils/format";
import { ChevronLeft, ChevronRight, Check, CreditCard, ChevronDown, ChevronUp } from "lucide-react";

export default function Invoices({ expenses, cards, paidInvoices, toggleInvoicePaid }) {
  const [curKey, setCurKey] = useState(currentMonthKey());
  const [expandedCards, setExpandedCards] = useState({});

  const toggleExpand = (cardId) => {
    setExpandedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const invoiceData = useMemo(() => {
    return cards.map(card => {
      const isObj = typeof card === "object";
      const id = isObj ? card.id : card;
      const name = isObj ? card.name : card;
      
      let total = 0;
      const entries = [];
      
      expenses.forEach(exp => {
        if (exp.cartao !== id && exp.cartao !== name) return;
        // getInstallmentEntries devolve um array de todas as parcelas já projetadas.
        const installments = getInstallmentEntries(exp, cards);
        const match = installments.find(i => i.key === curKey);
        
        if (match) {
          total += match.value;
          entries.push({
            exp,
            value: match.value,
            index: match.installmentIndex,
            totalInst: match.totalInstallments
          });
        }
      });
      
      // Ordena por data da compra (mais antigas primeiro)
      entries.sort((a, b) => a.exp.data.localeCompare(b.exp.data));
      
      return {
        id,
        name,
        total,
        entries,
        isPaid: !!paidInvoices[`${id}_${curKey}`]
      };
    }).filter(data => data.total > 0 || data.entries.length > 0);
  }, [cards, expenses, curKey, paidInvoices]);

  const totalInvoices = invoiceData.reduce((acc, curr) => acc + curr.total, 0);
  const totalPaid = invoiceData.filter(i => i.isPaid).reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="tab-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Navegador de Mês */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button className="icon-btn" onClick={() => setCurKey(shiftMonthKey(curKey, -1))}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{monthLabel(curKey)}</div>
        <button className="icon-btn" onClick={() => setCurKey(shiftMonthKey(curKey, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--gold)" /> Faturas de Cartão
        </h2>
        
        {invoiceData.length > 0 && (
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Total das faturas: <strong style={{ color: "var(--text)" }}>{formatBRL(totalInvoices)}</strong></span>
            <span>Faturas pagas: <strong style={{ color: "var(--sage)" }}>{formatBRL(totalPaid)}</strong></span>
            <span>Falta pagar: <strong style={{ color: "var(--gold)" }}>{formatBRL(totalInvoices - totalPaid)}</strong></span>
          </div>
        )}
      </div>

      {invoiceData.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <p>Você não tem nenhuma fatura para este mês.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {invoiceData.map(data => (
            <div key={data.id} className="card" style={{ padding: 0, overflow: "hidden", border: data.isPaid ? "1px solid var(--sage)" : "1px solid var(--border)" }}>
              {/* Header do Cartão */}
              <div 
                style={{ 
                  display: "flex", justifyContent: "space-between", alignItems: "center", 
                  padding: "16px", cursor: "pointer", 
                  background: data.isPaid ? "rgba(61, 214, 140, 0.05)" : "transparent"
                }}
                onClick={() => toggleExpand(data.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ 
                    width: 40, height: 28, borderRadius: 6, 
                    background: "var(--bg-elev)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center" 
                  }}>
                    <CreditCard size={16} color={data.isPaid ? "var(--sage)" : "var(--text-muted)"} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: data.isPaid ? "var(--text-muted)" : "var(--text)", textDecoration: data.isPaid ? "line-through" : "none" }}>
                      {data.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                      {data.entries.length} compras
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div className="money-blur" style={{ fontWeight: 700, fontSize: 15, color: data.isPaid ? "var(--text-muted)" : "var(--text)" }}>
                      {formatBRL(data.total)}
                    </div>
                    {data.isPaid && <div style={{ fontSize: 11, color: "var(--sage)", fontWeight: 600 }}>PAGA</div>}
                  </div>
                  {expandedCards[data.id] ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>
              </div>

              {/* Corpo da Fatura (Lista de Compras) */}
              {expandedCards[data.id] && (
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg)", padding: "12px 16px" }}>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {data.entries.map((item, i) => {
                      const parts = item.exp.data.split("-");
                      const dateStr = `${parts[2]}/${parts[1]}`;
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px dashed var(--border)", paddingBottom: 8 }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ color: "var(--text)" }}>{item.exp.descricao}</span>
                            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{dateStr} {item.totalInst !== 1 && `(Parc. ${item.index}/${item.totalInst})`}</span>
                            {item.exp.notas && <span style={{ color: "var(--text-dim)", fontSize: 11, fontStyle: "italic", marginTop: 2 }}>{item.exp.notas}</span>}
                          </div>
                          <span className="money-blur" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatBRL(item.value)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <button 
                    className="btn-primary" 
                    style={{ 
                      width: "100%", 
                      background: data.isPaid ? "var(--bg-hover)" : "var(--sage)", 
                      color: data.isPaid ? "var(--text-muted)" : "#fff",
                      border: data.isPaid ? "1px solid var(--border)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                    }}
                    onClick={(e) => { e.stopPropagation(); toggleInvoicePaid(data.id, curKey); }}
                  >
                    {data.isPaid ? (
                      <>Desmarcar como Paga</>
                    ) : (
                      <><Check size={16} /> Marcar Fatura como Paga</>
                    )}
                  </button>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
