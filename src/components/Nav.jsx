import { Plus, LayoutDashboard, Receipt, Wallet, BarChart3 } from "lucide-react";

const TABS = [
  { key: "form",      label: "Novo",       Icon: Plus },
  { key: "dashboard", label: "Painel",     Icon: LayoutDashboard },
  { key: "report",    label: "Relatório",  Icon: Receipt },
  { key: "budget",    label: "Orçamento",  Icon: BarChart3 },
  { key: "splitter",  label: "Organizar",  Icon: Wallet },
];

export default function Nav({ active, onChange }) {
  return (
    <nav className="nav" role="navigation" aria-label="Navegação principal">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          id={`nav-${key}`}
          className={`nav__btn${active === key ? " active" : ""}`}
          onClick={() => onChange(key)}
          aria-current={active === key ? "page" : undefined}
        >
          <Icon size={20} strokeWidth={active === key ? 2.5 : 2} />
          {label}
          <span className="nav__indicator" />
        </button>
      ))}
    </nav>
  );
}
