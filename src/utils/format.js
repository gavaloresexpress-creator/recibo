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

export function getInvoiceMonth(compraData, cartaoObj) {
  if (!compraData) return "";
  if (!cartaoObj) return monthKeyOf(compraData);
  const [y, m, d] = compraData.split("-").map(Number);
  const fechamento = cartaoObj.fechamento || 25;
  const vencimento = cartaoObj.vencimento || 1;
  
  let offset = 0;
  // Se o vencimento é menor ou igual ao fechamento, significa que a fatura 
  // é paga no mês seguinte ao fechamento.
  if (vencimento <= fechamento) {
    offset += 1;
  }
  
  // Se comprou no dia do fechamento ou depois, a compra entra apenas na fatura seguinte.
  if (d >= fechamento) {
    offset += 1;
  }
  
  const paymentDate = new Date(y, m - 1 + offset, 1);
  return `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, "0")}`;
}

export function getInstallmentEntries(expense, cards = []) {
  const isRecurring = expense.isRecurring === true;
  // Se for recorrente, projeta para os próximos 24 meses (para aparecer nos gráficos/dashboards).
  const parcelas = isRecurring ? 24 : Math.max(1, Number(expense.parcelas) || 1);
  const valorParcela = isRecurring ? Number(expense.valor) : Number(expense.valor) / parcelas;

  let startY, startM;
  // 1. Se tem cartão, tenta calcular o mês inicial usando a lógica de fechamento da fatura
  // Tratamento de legado: gastos antigos podem não ter 'formaPagamento' salvo no banco.
  const isCredit = expense.formaPagamento === "credito" || (!expense.formaPagamento && expense.cartao);
  
  if (isCredit && expense.cartao && expense.data) {
    const cardObj = cards.find(c => c.id === expense.cartao || c.name === expense.cartao);
    const invoiceMonth = getInvoiceMonth(expense.data, cardObj);
    [startY, startM] = invoiceMonth.split("-").map(Number);
  } else if (expense.mesInicioParcelas) {
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

export function getPurchaseEntries(expense) {
  const isRecurring = expense.isRecurring === true;
  const parcelas = isRecurring ? 24 : Math.max(1, Number(expense.parcelas) || 1);
  const valorParcela = isRecurring ? Number(expense.valor) : Number(expense.valor) / parcelas;

  let startY, startM;
  if (expense.mesInicioParcelas) {
    [startY, startM] = expense.mesInicioParcelas.split("-").map(Number);
  } else if (expense.data) {
    [startY, startM] = expense.data.split("-").map(Number);
  } else {
    return [];
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
      installmentIndex: i + 1,
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
