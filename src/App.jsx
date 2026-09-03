import { useState, useCallback, useEffect } from "react";
import { LogOut, Sun, Moon, Eye, EyeOff, Menu } from "lucide-react";
import { useAuth }          from "./hooks/useAuth";
import { useExpenseStore }  from "./hooks/useExpenseStore";
import { useBudgetStore }   from "./hooks/useBudgetStore";
import { formatBRL, currentMonthKey, getInstallmentEntries } from "./utils/format";
import Nav            from "./components/Nav";
import Toast          from "./components/Toast";
import DeleteModal    from "./components/DeleteModal";
import LoginScreen    from "./components/LoginScreen";
import ExpenseForm    from "./components/ExpenseForm";
import Dashboard      from "./components/Dashboard";
import Report         from "./components/Report";
import BudgetManager  from "./components/BudgetManager";
import BillsManager   from "./components/BillsManager";
import FinanceSplitter from "./components/FinanceSplitter";
import Invoices        from "./components/Invoices";
import Sidebar         from "./components/Sidebar";

// ─────────────────────────────────────────────────────────────
//  Header com info do usuário logado
// ─────────────────────────────────────────────────────────────
function Header({ expenses, user, onSignOut, onOpenMenu }) {
  const curKey = currentMonthKey();

  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem("theme") === "light";
  });
  
  const [hideValues, setHideValues] = useState(() => {
    return localStorage.getItem("hideValues") === "true";
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add("theme-light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("theme-light");
      localStorage.setItem("theme", "dark");
    }
  }, [isLightMode]);

  useEffect(() => {
    if (hideValues) {
      document.documentElement.classList.add("hide-values");
      localStorage.setItem("hideValues", "true");
    } else {
      document.documentElement.classList.remove("hide-values");
      localStorage.setItem("hideValues", "false");
    }
  }, [hideValues]);

  return (
    <header className="header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="icon-btn" onClick={onOpenMenu} style={{ background: "none", border: "none", color: "var(--text)", padding: 0 }}>
          <Menu size={24} />
        </button>
        <div className="header__brand" style={{ margin: 0 }}>
          <h1 className="header__title" style={{ fontSize: 20 }}>Recibo</h1>
          <p className="header__sub" style={{ display: "none" }}>Controle de gastos</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

        {/* Theme Toggle */}
        <button
          className="icon-btn"
          onClick={() => setIsLightMode(!isLightMode)}
          title="Alternar tema"
          style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Hide Values Toggle */}
        <button
          className="icon-btn"
          onClick={() => setHideValues(!hideValues)}
          title={hideValues ? "Mostrar valores" : "Ocultar valores"}
          style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        {/* Avatar + logout */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "Usuário"}
              title={`${user.displayName}\n${user.email}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid var(--border)",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--gold-dim)",
              border: "2px solid var(--gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "var(--gold)",
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {(user?.displayName || user?.email || "?")[0].toUpperCase()}
            </div>
          )}

          <button
            onClick={onSignOut}
            title="Sair"
            id="btn-logout"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--rust)";
              e.currentTarget.style.color = "var(--rust)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
//  App Root
// ─────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut, authError } = useAuth();

  const userId = user?.uid ?? null;

  const { expenses, cards, categories, splitterEnvelopes, bills, loading: dataLoading, addExpense, deleteExpense, updateExpense, addCard, removeCard, updateCard, addCategory, updateCategory, deleteCategory, updateSplitterEnvelopes, addBill, deleteBill, updateBill, paidInvoices, toggleInvoicePaid }
    = useExpenseStore(userId);

  const { budgets, setBudget }
    = useBudgetStore(userId, categories);

  const [tab,          setTab]          = useState("form");
  const [toast,        setToast]        = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget,   setEditTarget]   = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSaved = useCallback((tipoStr = "despesa") => {
    const noun = tipoStr === "receita" ? "Recebimento" : "Gasto";
    const action = editTarget ? "atualizado" : "salvo";
    setToast(`${noun} ${action} com sucesso!`);
    setTab(editTarget ? "report" : "dashboard");
    setEditTarget(null);
  }, [editTarget]);

  const handleEditRequest = useCallback((expense) => {
    setEditTarget(expense);
    setTab("form");
  }, []);

  const handleDeleteRequest = useCallback((expense) => {
    setDeleteTarget(expense);
  }, []);

  const handleDeleteConfirm = useCallback(async (id) => {
    await deleteExpense(id);
    setDeleteTarget(null);
    setToast("Gasto excluído.");
  }, [deleteExpense]);

  // ── Loading de autenticação ──────────────────────────────────
  if (authLoading) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
        <p>Verificando sessão...</p>
      </div>
    );
  }

  // ── Usuário não autenticado ──────────────────────────────────
  if (!user) {
    return <LoginScreen onSignIn={signInWithGoogle} error={authError} />;
  }

  // ── App principal ────────────────────────────────────────────
  return (
    <div className="app">
      <Header expenses={expenses} user={user} onSignOut={signOut} onOpenMenu={() => setIsSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} active={tab} onChange={setTab} />

      <main className="main-content" id="main-content" role="main">
        {dataLoading ? (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 40 }}>
            <div className="loading__spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando seus dados...</span>
          </div>
        ) : (
          <>
            {tab === "form" && (
              <ExpenseForm
                cards={cards}
                categories={categories}
                expenses={expenses}
                onAdd={editTarget ? (data) => updateExpense(editTarget.id, data) : addExpense}
                onAddCard={addCard}
                onUpdateCard={updateCard}
                onRemoveCard={removeCard}
                addCategory={addCategory}
                updateCategory={updateCategory}
                deleteCategory={deleteCategory}
                onSaved={handleSaved}
                initialExpense={editTarget}
                onCancelEdit={() => {
                  setEditTarget(null);
                  setTab("report");
                }}
              />
            )}
            {tab === "dashboard" && (
              <Dashboard expenses={expenses} categories={categories} cards={cards} budgets={budgets} bills={bills} />
            )}
            {tab === "report" && (
              <Report
                expenses={expenses}
                cards={cards}
                categories={categories}
                onDeleteRequest={handleDeleteRequest}
                onEditRequest={handleEditRequest}
              />
            )}
            {tab === "budget" && (
              <BudgetManager
                expenses={expenses}
                cards={cards}
                categories={categories}
                budgets={budgets}
                setBudget={setBudget}
              />
            )}
            {tab === "bills" && (
              <BillsManager
                bills={bills}
                addBill={addBill}
                updateBill={updateBill}
                deleteBill={deleteBill}
                categories={categories}
                addExpense={addExpense}
              />
            )}
            {tab === "splitter" && (
              <FinanceSplitter envelopes={splitterEnvelopes} onUpdateEnvelopes={updateSplitterEnvelopes} />
            )}
            {tab === "invoices" && (
              <Invoices
                expenses={expenses}
                cards={cards}
                paidInvoices={paidInvoices}
                toggleInvoicePaid={toggleInvoicePaid}
              />
            )}
          </>
        )}
      </main>

      <Nav active={tab} onChange={setTab} />

      <Toast message={toast} onClear={() => setToast("")} />

      <DeleteModal
        item={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
