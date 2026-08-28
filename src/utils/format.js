export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function formatBRL(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseBRL(str) {
  // Remove tudo exceto dígitos e vírgula
  const clean = String(str).replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function monthKeyOf(iso) {
  return iso ? iso.slice(0, 7) : "";
}

export function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return s.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function getInstallmentEntries(expense) {
  const isRecurring = expense.isRecurring === true;
  // Se for recorrente, projeta para os próximos 24 meses (para aparecer nos gráficos/dashboards).
  const parcelas = isRecurring ? 24 : Math.max(1, Number(expense.parcelas) || 1);
  const valorParcela = isRecurring ? Number(expense.valor) : Number(expense.valor) / parcelas;

  // Usa mesInicioParcelas se definido (ex: compra feita após fechamento da fatura),
  // caso contrário usa o mês da data da compra
  let startY, startM;
  if (expense.mesInicioParcelas) {
    [startY, startM] = expense.mesInicioParcelas.split("-").map(Number);
  } else {
    [startY, startM] = expense.data.split("-").map(Number);
  }

  const entries = [];
  for (let i = 0; i < parcelas; i++) {
    const dt = new Date(startY, startM - 1 + i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    entries.push({
      key,
      value: valorParcela,
      categoria: expense.categoria,
      cartao: expense.cartao,
      id: expense.id,
      tipo: expense.tipo || "despesa",
      installmentIndex: isRecurring ? i + 1 : i + 1,
      totalInstallments: isRecurring ? "∞" : parcelas,
      isRecurring,
    });
  }
  return entries;
}

// Mascara monetária: converte "123456" → "1.234,56"
export function maskCurrency(raw) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function currencyToNumber(masked) {
  if (!masked) return 0;
  return parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
}
