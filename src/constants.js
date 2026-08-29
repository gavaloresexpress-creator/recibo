import PixIcon from "./components/PixIcon";

export const DEFAULT_CATEGORIES = [
  // Despesas
  { key: "alimentacao", label: "Alimentação",  color: "#F0A500", icon: "🍔", tipo: "despesa" },
  { key: "transporte",  label: "Transporte",   color: "#3B82F6", icon: "🚗", tipo: "despesa" },
  { key: "moradia",     label: "Moradia",      color: "#8B5CF6", icon: "🏠", tipo: "despesa" },
  { key: "saude",       label: "Saúde",        color: "#EF4444", icon: "💊", tipo: "despesa" },
  { key: "educacao",    label: "Educação",     color: "#10B981", icon: "📚", tipo: "despesa" },
  { key: "lazer",       label: "Lazer",        color: "#F59E0B", icon: "🎮", tipo: "despesa" },
  { key: "compras",     label: "Compras",      color: "#EC4899", icon: "🛍️", tipo: "despesa" },
  { key: "assinaturas", label: "Assinaturas",  color: "#06B6D4", icon: "📱", tipo: "despesa" },
  { key: "viagem",      label: "Viagem",       color: "#84CC16", icon: "✈️", tipo: "despesa" },
  { key: "outros",      label: "Outros",       color: "#6B7280", icon: "📦", tipo: "despesa" },
  // Receitas
  { key: "salario",     label: "Salário",      color: "#10B981", icon: "💼", tipo: "receita" },
  { key: "investimentos",label:"Investimentos",color: "#3B82F6", icon: "📈", tipo: "receita" },
  { key: "freelance",   label: "Freelance",    color: "#8B5CF6", icon: "💻", tipo: "receita" },
  { key: "renda_extra", label: "Renda Extra",  color: "#F59E0B", icon: "🎁", tipo: "receita" },
];

export const DEFAULT_CARDS = ["Nubank", "Inter", "Itaú"];

export const INSTALLMENT_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48];

export const PAYMENT_METHODS = [
  { key: "credito",  label: "Crédito",  icon: "💳", color: "#E6B44A" },
  { key: "pix",      label: "PIX",      icon: <PixIcon size={14} />, color: "#3DD68C" },
  { key: "debito",   label: "Débito",   icon: "🏦", color: "#5B8DEF" },
  { key: "dinheiro", label: "Dinheiro", icon: "💵", color: "#84CC16" },
];

