import { X, LayoutDashboard, Receipt, Wallet, BarChart3, Calendar, CreditCard, Plus } from "lucide-react";

export default function Sidebar({ isOpen, onClose, active, onChange }) {
  if (!isOpen) return null;

  const TABS = [
    { key: "form",      label: "Novo Lançamento", Icon: Plus },
    { key: "dashboard", label: "Painel Principal",Icon: LayoutDashboard },
    { key: "bills",     label: "Contas a Pagar",  Icon: Calendar },
    { key: "report",    label: "Relatório Mensal",Icon: Receipt },
    { key: "budget",    label: "Orçamento",       Icon: BarChart3 },
    { key: "invoices",  label: "Faturas",         Icon: CreditCard },
    { key: "splitter",  label: "Organizar (50/30/20)", Icon: Wallet },
  ];

  return (
    <>
      <div 
        style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)", zIndex: 999, backdropFilter: "blur(2px)"
        }}
        onClick={onClose}
      />
      
      <div className="sidebar" style={{
        position: "fixed", top: 0, left: 0, width: "280px", height: "100%",
        background: "var(--bg-elev)", zIndex: 1000, display: "flex", flexDirection: "column",
        boxShadow: "2px 0 12px rgba(0,0,0,0.2)",
        animation: "slideIn 0.3s forwards"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--gold)" }}>Menu</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { onChange(key); onClose(); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderRadius: 8, cursor: "pointer", border: "none", textAlign: "left",
                fontSize: 15, fontWeight: 500,
                background: active === key ? "rgba(230, 180, 74, 0.1)" : "transparent",
                color: active === key ? "var(--gold)" : "var(--text)"
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>
    </>
  );
}
