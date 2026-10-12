function getInvoiceMonth(compraData, cartaoObj) {
  if (!compraData) return "";
  if (!cartaoObj) return compraData.slice(0, 7);
  const [y, m, d] = compraData.split("-").map(Number);
  const fechamento = cartaoObj.fechamento || 25;
  const vencimento = cartaoObj.vencimento || 1;
  let offset = 0;
  if (vencimento <= fechamento) offset += 1;
  if (d >= fechamento) offset += 1;
  const paymentDate = new Date(y, m - 1 + offset, 1);
  return `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, "0")}`;
}

function getInstallmentEntries(expense, cards = []) {
  const isRecurring = expense.isRecurring === true;
  const parcelas = isRecurring ? 24 : Math.max(1, Number(expense.parcelas) || 1);
  const valorParcela = isRecurring ? Number(expense.valor) : Number(expense.valor) / parcelas;
  let startY, startM;
  const isCredit = expense.formaPagamento === "credito" || (!expense.formaPagamento && expense.cartao);
  if (expense.mesInicioParcelas) {
    [startY, startM] = expense.mesInicioParcelas.split("-").map(Number);
  } else if (isCredit && expense.cartao && (expense.data || expense.date)) {
    const expDate = expense.data || expense.date;
    const cardObj = cards.find((c) =>
      typeof c === "object" ? c.id === expense.cartao || c.name === expense.cartao : c === expense.cartao
    );
    const invoiceMonth = getInvoiceMonth(expDate, cardObj);
    [startY, startM] = invoiceMonth.split("-").map(Number);
  } else if (expense.data || expense.date) {
    const expDate = expense.data || expense.date;
    [startY, startM] = expDate.split("-").map(Number);
  } else {
    return [];
  }

  const entries = [];
  for (let i = 0; i < parcelas; i++) {
    const dt = new Date(startY, startM - 1 + i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (isRecurring && expense.endMonth && key > expense.endMonth) continue;
    entries.push({
      key,
      value: valorParcela,
      descricao: expense.descricao,
      cartao: expense.cartao,
      id: expense.id,
      tipo: expense.tipo || "despesa",
      installmentIndex: i + 1,
      totalInstallments: isRecurring ? "∞" : parcelas,
    });
  }
  return entries;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API Key não configurada no servidor." });
  }

  const { text, categories, cards, expenses, paidInvoices, clientDate } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Texto do comando é obrigatório." });
  }

  try {
    const today = clientDate || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const currentMonthPrefix = today.slice(0, 7); // ex: "2026-10"

    const categoryNames = (categories || []).map((c) => c.label).join(", ");
    const cardNames = (cards || []).map((c) => (typeof c === "object" ? c.name : c)).join(", ");

    const catMap = Object.fromEntries((categories || []).map((c) => [c.key, c.label]));
    const cardMap = Object.fromEntries(
      (cards || []).map((c) => [typeof c === "object" ? c.id : c, typeof c === "object" ? c.name : c])
    );

    // Calcula as faturas por cartão (diferenciando a fatura aberta atual da fatura que já venceu/paga)
    const cardInvoices = (cards || []).map((card) => {
      const id = typeof card === "object" ? card.id : card;
      const name = typeof card === "object" ? card.name : card;
      const fechamento = typeof card === "object" ? card.fechamento || 25 : 25;
      const vencimento = typeof card === "object" ? card.vencimento || 1 : 1;

      // Mês de vencimento da fatura ABERTA atual (acumulando compras deste mês para pagamento no mês seguinte)
      const mesFaturaAberta = getInvoiceMonth(today, card); // ex: "2026-11"

      // Mês de vencimento da fatura do mês atual (compras fechadas no mês anterior, que venceram neste mês)
      const mesFaturaMesAtual = currentMonthPrefix; // ex: "2026-10"

      let totalFaturaAberta = 0;
      let totalFaturaMesAtual = 0;
      const itensFaturaAberta = [];
      const itensFaturaMesAtual = [];

      (expenses || []).forEach((exp) => {
        if (exp.cartao !== id && exp.cartao !== name) return;
        const entries = getInstallmentEntries(exp, cards);
        entries.forEach((e) => {
          if (e.tipo === "receita") return;
          if (e.key === mesFaturaAberta) {
            totalFaturaAberta += e.value;
            itensFaturaAberta.push({
              descricao: exp.descricao,
              valorParcela: Math.round(e.value * 100) / 100,
              parcela: `${e.installmentIndex}/${e.totalInstallments}`,
              dataCompra: exp.data || exp.date,
            });
          } else if (e.key === mesFaturaMesAtual) {
            totalFaturaMesAtual += e.value;
            itensFaturaMesAtual.push({
              descricao: exp.descricao,
              valorParcela: Math.round(e.value * 100) / 100,
              parcela: `${e.installmentIndex}/${e.totalInstallments}`,
              dataCompra: exp.data || exp.date,
            });
          }
        });
      });

      const isFaturaMesAtualPaga = !!(
        paidInvoices &&
        (paidInvoices[`${id}_${mesFaturaMesAtual}`] || paidInvoices[`${name}_${mesFaturaMesAtual}`])
      );

      return {
        cartao: name,
        fechamento: `dia ${fechamento}`,
        vencimento: `dia ${vencimento}`,
        faturaAbertaAtual: {
          explicacao: `Esta é a fatura ABERTA atual, acumulando as compras feitas neste mês (${today}). Ela fechará no dia ${fechamento} e vencerá no mês que vem (${mesFaturaAberta}).`,
          mesVencimento: mesFaturaAberta,
          total: Math.round(totalFaturaAberta * 100) / 100,
          itens: itensFaturaAberta,
        },
        faturaMesAnteriorVencidaEsteMes: {
          explicacao: `Fatura referente a compras do mês anterior com vencimento neste mês (${mesFaturaMesAtual}).`,
          mesVencimento: mesFaturaMesAtual,
          total: Math.round(totalFaturaMesAtual * 100) / 100,
          status: isFaturaMesAtualPaga ? "PAGA" : "Vencida / A pagar",
          itens: itensFaturaMesAtual,
        },
      };
    });

    // Mapeia os lançamentos tratando tanto 'data' quanto 'date'
    const recentExpenses = (expenses || []).map((e) => {
      const expDate = e.data || e.date || "";
      const catLabel = catMap[e.categoria] || e.categoria || "Outros";
      const cardName = cardMap[e.cartao] || e.cartao || "";
      return {
        data: expDate,
        desc: e.descricao || "",
        cat: catLabel,
        cartao: cardName,
        forma: e.formaPagamento || "",
        valor: Number(e.valor) || 0,
        tipo: e.tipo || "despesa",
      };
    });

    const prompt = `Você é um assistente financeiro inteligente e preciso do aplicativo "Recibo".
O usuário disse o seguinte comando ou pergunta por voz: "${text}"

CONTEXTO DO USUÁRIO:
- Data de hoje: ${today} (formato YYYY-MM-DD)
- Mês atual: ${currentMonthPrefix}
- Categorias disponíveis: ${categoryNames}
- Cartões cadastrados: ${cardNames}

VALORES OFICIAIS DAS FATURAS DE CARTÃO DE CRÉDITO:
${JSON.stringify(cardInvoices, null, 2)}

HISTÓRICO DE LANÇAMENTOS CADASTRADOS (${recentExpenses.length} transações):
${JSON.stringify(recentExpenses)}

INSTRUÇÕES CRÍTICAS PARA RESPOSTAS:
1. PERGUNTAS SOBRE "FATURA ATUAL" OU "FATURA DO CARTÃO" (ex: "em quantos reais está minha fatura atual?", "quanto está minha fatura no cartão Inter?", "quanto tenho de fatura?"):
   - "action": "answer", "data": null
   - REGRA DE OURO: Quando o usuário pergunta pela sua "fatura atual", ele está se referindo à FATURA ABERTA ATUAL ("faturaAbertaAtual"), que acumula as compras deste mês e será paga no mês que vem!
   - A fatura anterior que venceu no início deste mês geralmente já foi paga.
   - Responda informando com clareza o valor da FATURA ABERTA ATUAL (campo "faturaAbertaAtual.total"). Exemplo: "Sua fatura atual do cartão Inter (a ser paga no mês que vem) está em R$ X,XX."
   - Se a fatura anterior com vencimento neste mês constar como "PAGA", você pode complementar amigavelmente: "A fatura anterior deste mês já consta como paga."

2. PERGUNTAS SOBRE FECHAMENTO, VENCIMENTO OU EM QUAL FATURA UMA COMPRA ENTRA (ex: "quando fecha a fatura do Inter?", "se eu comprar dia 1 cai em qual fatura?", "qual meu melhor dia de compra?"):
   - "action": "answer", "data": null
   - Consulte os dados do cartão em "VALORES OFICIAIS DAS FATURAS DE CARTÃO DE CRÉDITO".
   - Explique claramente:
     * O cartão fecha no dia cadastrado e vence no dia cadastrado.
     * Uma compra feita no dia 1 (antes do fechamento) entra na fatura que fecha neste mês e será paga no vencimento do mês seguinte.
     * Compras feitas a partir do dia do fechamento só entram na fatura subsequente, dando até 40 dias para pagar.
   - Responda de forma prestativa, clara e natural.

3. PERGUNTAS SOBRE GASTOS GERAIS OU COMPRAS FEITAS NO MÊS (ex: "quanto gastei esse mês?", "quanto gastei com combustível?"):
   - "action": "answer", "data": null
   - Some os lançamentos do histórico cuja data inicie em "${currentMonthPrefix}".
   - "despesa" representa saídas/gastos. "receita" representa entradas/ganhos.
   - Responda informando o total com exatidão em Reais.

3. CADASTRO DE GASTO OU RECEITA (ex: "gastei 50 na padaria no débito com nota pão e queijo", "gastei 34,90 de ferragista com nota fita de carga", "recebi 138 de pix com nota repasse"):
   - "action": "add_expense"
   - Preencha o objeto "data" com os dados extraídos.
   - Em "descricao", coloque um título curto e objetivo (ex: "Ferragista", "Padaria", "Bebidas").
   - Em "notas", capture qualquer detalhe, observação, item específico ou especificação dita pelo usuário (ex: "Fita de carga", "Café e queijo", "Repasse"). Se o usuário não mencionar nenhum detalhe extra, deixe "".
   - Use a data de hoje (${today}) se nenhuma data for mencionada.
   - No campo "message", confirme o lançamento de forma amigável e curta.

Retorne APENAS um objeto JSON válido (sem markdown, sem texto fora do JSON):
{
  "action": "add_expense" ou "answer",
  "data": {
    "valor": (número, ex: 50.5),
    "descricao": (string, título curto),
    "notas": (string, observação/detalhe especificado pelo usuário, ou "" se não houver),
    "categoria": (string, nome de uma das categorias disponíveis, ou "Outros"),
    "cartao": (string, nome de um dos cartões, ou "" se não usou crédito),
    "formaPagamento": (string: "credito", "debito", "pix" ou "dinheiro"),
    "tipo": (string: "despesa" ou "receita"),
    "data": (string: YYYY-MM-DD)
  },
  "message": (string, resposta curta e amigável para o usuário)
}`;

    // Modelos ordenados por estabilidade e velocidade, com fallback automático
    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.7-flash",
      "gemini-flash-latest",
      "gemini-3.8-flash",
    ];

    let geminiRes = null;

    for (const modelName of models) {
      try {
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        );
        if (geminiRes && geminiRes.ok) break;
      } catch (err) {
        console.warn(`Tentativa no modelo ${modelName} falhou:`, err?.message);
      }
    }

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini API error:", errBody);
      return res.status(502).json({ error: `Gemini ${geminiRes.status}: ${errBody.slice(0, 200)}` });
    }

    const geminiData = await geminiRes.json();
    const jsonStr = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: "A IA retornou um formato inválido." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message || "Erro interno no servidor." });
  }
}
