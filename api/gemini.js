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

    function round2(v) {
      return Math.round((Number(v) || 0) * 100) / 100;
    }

    // Mês anterior (para comparações históricas)
    const [curY, curM] = currentMonthPrefix.split("-").map(Number);
    const prevMonthDt = new Date(curY, curM - 2, 1);
    const prevMonthPrefix = `${prevMonthDt.getFullYear()}-${String(prevMonthDt.getMonth() + 1).padStart(2, "0")}`;

    // RESUMO MATEMÁTICO DO MÊS ATUAL (100% exato via código)
    const resumoMesAtual = {
      mes: currentMonthPrefix,
      totalGastoDespesas: 0,
      totalReceitas: 0,
      saldo: 0,
      totaisPorCategoria: {},
      totaisPorFormaPagamento: {},
      totaisPorCartao: {},
      maioresDespesas: [],
    };

    // RESUMO MATEMÁTICO DO MÊS ANTERIOR
    const resumoMesAnterior = {
      mes: prevMonthPrefix,
      totalGastoDespesas: 0,
      totalReceitas: 0,
      totaisPorCategoria: {},
    };

    // RESUMO GERAL HISTÓRICO
    const resumoGeralHistorico = {
      totalGastoDespesas: 0,
      totalReceitas: 0,
      totaisPorCategoria: {},
    };

    // Mapeia e totaliza cada transação
    const recentExpenses = (expenses || []).map((e) => {
      const expDate = e.data || e.date || "";
      const catLabel = catMap[e.categoria] || e.categoria || "Outros";
      const cardName = cardMap[e.cartao] || e.cartao || "";
      const val = round2(e.valor);
      const tipo = e.tipo === "receita" ? "receita" : "despesa";
      const forma = e.formaPagamento || "outros";

      // 1. Acúmulo Geral Histórico
      if (tipo === "receita") {
        resumoGeralHistorico.totalReceitas = round2(resumoGeralHistorico.totalReceitas + val);
      } else {
        resumoGeralHistorico.totalDespesas = round2(resumoGeralHistorico.totalDespesas + val);
        resumoGeralHistorico.totaisPorCategoria[catLabel] = round2(
          (resumoGeralHistorico.totaisPorCategoria[catLabel] || 0) + val
        );
      }

      // 2. Acúmulo Mês Atual
      if (expDate.startsWith(currentMonthPrefix)) {
        if (tipo === "receita") {
          resumoMesAtual.totalReceitas = round2(resumoMesAtual.totalReceitas + val);
        } else {
          resumoMesAtual.totalGastoDespesas = round2(resumoMesAtual.totalGastoDespesas + val);

          if (!resumoMesAtual.totaisPorCategoria[catLabel]) {
            resumoMesAtual.totaisPorCategoria[catLabel] = {
              total: 0,
              quantidade: 0,
              itens: [],
            };
          }
          resumoMesAtual.totaisPorCategoria[catLabel].total = round2(
            resumoMesAtual.totaisPorCategoria[catLabel].total + val
          );
          resumoMesAtual.totaisPorCategoria[catLabel].quantidade += 1;
          resumoMesAtual.totaisPorCategoria[catLabel].itens.push({
            desc: e.descricao || "",
            valor: val,
            data: expDate,
            forma,
            cartao: cardName,
          });

          resumoMesAtual.totaisPorFormaPagamento[forma] = round2(
            (resumoMesAtual.totaisPorFormaPagamento[forma] || 0) + val
          );

          if (cardName) {
            resumoMesAtual.totaisPorCartao[cardName] = round2(
              (resumoMesAtual.totaisPorCartao[cardName] || 0) + val
            );
          }

          resumoMesAtual.maioresDespesas.push({
            desc: e.descricao || "",
            valor: val,
            cat: catLabel,
            data: expDate,
          });
        }
      }

      // 3. Acúmulo Mês Anterior
      if (expDate.startsWith(prevMonthPrefix)) {
        if (tipo === "receita") {
          resumoMesAnterior.totalReceitas = round2(resumoMesAnterior.totalReceitas + val);
        } else {
          resumoMesAnterior.totalGastoDespesas = round2(resumoMesAnterior.totalGastoDespesas + val);
          resumoMesAnterior.totaisPorCategoria[catLabel] = round2(
            (resumoMesAnterior.totaisPorCategoria[catLabel] || 0) + val
          );
        }
      }

      return {
        data: expDate,
        desc: e.descricao || "",
        cat: catLabel,
        cartao: cardName,
        forma,
        valor: val,
        tipo,
      };
    });

    resumoMesAtual.saldo = round2(resumoMesAtual.totalReceitas - resumoMesAtual.totalGastoDespesas);
    resumoMesAtual.maioresDespesas.sort((a, b) => b.valor - a.valor);
    resumoMesAtual.maioresDespesas = resumoMesAtual.maioresDespesas.slice(0, 5);

    const prompt = `Você é um assistente financeiro inteligente e matematicamente rigoroso do aplicativo "Recibo".
O usuário disse o seguinte comando ou pergunta por voz: "${text}"

CONTEXTO DO USUÁRIO:
- Data de hoje: ${today} (formato YYYY-MM-DD)
- Mês atual: ${currentMonthPrefix}
- Mês anterior: ${prevMonthPrefix}
- Categorias disponíveis: ${categoryNames}
- Cartões cadastrados: ${cardNames}

RESUMO FINANCEIRO MATEMATICAMENTE EXATO DO MÊS ATUAL (${currentMonthPrefix}):
(Pré-calculado sem erros aritméticos com base nas transações reais):
${JSON.stringify(resumoMesAtual, null, 2)}

RESUMO DO MÊS ANTERIOR (${prevMonthPrefix}):
${JSON.stringify(resumoMesAnterior, null, 2)}

RESUMO GERAL HISTÓRICO:
${JSON.stringify(resumoGeralHistorico, null, 2)}

VALORES OFICIAIS DAS FATURAS DE CARTÃO DE CRÉDITO:
${JSON.stringify(cardInvoices, null, 2)}

HISTÓRICO COMPLETO DE LANÇAMENTOS CADASTRADOS (${recentExpenses.length} transações):
${JSON.stringify(recentExpenses)}

INSTRUÇÕES CRÍTICAS PARA RESPOSTAS COM EXATIDÃO MÁXIMA:
1. PERGUNTAS SOBRE TOTAIS DE CATEGORIAS, GASTOS DO MÊS, SALDO OU FORMAS DE PAGAMENTO:
   - "action": "answer", "data": null
   - REGRA DE OURO: Use SEMPRE os números exatos do bloco "RESUMO FINANCEIRO MATEMATICAMENTE EXATO DO MÊS ATUAL". NUNCA tente somar de cabeça itens avulsos.
   - Exemplos de respostas exatas:
     * "quanto gastei com [categoria]?" (ex: alimentação, combustível, educação, outros):
       Consulte "resumoMesAtual.totaisPorCategoria[categoria].total". Se a categoria tiver gastos, informe o valor exato pré-calculado e, se conveniente, mencione os itens e suas quantidades. Se a categoria não tiver gastos, diga: "Você ainda não registrou gastos na categoria X este mês."
     * "quanto gastei no total este mês?" ou "qual o total de gastos?":
       Use exatamente "resumoMesAtual.totalGastoDespesas".
     * "quanto recebi este mês?" ou "minhas receitas":
       Use exatamente "resumoMesAtual.totalReceitas".
     * "qual meu saldo?" ou "quanto sobrou?":
       Use exatamente "resumoMesAtual.saldo".
     * "quanto gastei no débito / pix / crédito?":
       Consulte "resumoMesAtual.totaisPorFormaPagamento".
     * "qual foi minha maior despesa?":
       Consulte "resumoMesAtual.maioresDespesas".
     * "gastei mais que no mês passado?":
       Compare "resumoMesAtual.totalGastoDespesas" com "resumoMesAnterior.totalGastoDespesas".

2. PERGUNTAS SOBRE ITENS ESPECÍFICOS POR NOME (ex: "quanto gastei na padaria?", "quanto paguei na faculdade?"):
   - "action": "answer", "data": null
   - Se for uma despesa específica, localize-a no histórico e informe o valor exato registrado e a data.

3. PERGUNTAS SOBRE "FATURA ATUAL" OU "FATURA DO CARTÃO":
   - "action": "answer", "data": null
   - REGRA: Quando o usuário pergunta pela sua "fatura atual", ele está se referindo à FATURA ABERTA ATUAL ("faturaAbertaAtual"), que acumula as compras deste mês e será paga no mês que vem!
   - Responda informando com clareza o valor da FATURA ABERTA ATUAL (campo "faturaAbertaAtual.total"). Exemplo: "Sua fatura atual do cartão Inter (a ser paga no mês que vem) está em R$ X,XX."
   - Se a fatura anterior com vencimento neste mês constar como "PAGA", você pode complementar amigavelmente: "A fatura anterior deste mês já consta como paga."

4. PERGUNTAS SOBRE FECHAMENTO, VENCIMENTO OU EM QUAL FATURA UMA COMPRA ENTRA:
   - "action": "answer", "data": null
   - Consulte os dados do cartão em "VALORES OFICIAIS DAS FATURAS DE CARTÃO DE CRÉDITO".
   - Explique claramente o dia de fechamento e o dia de vencimento, e se compras antes/depois do fechamento caem nesta fatura ou na seguinte.

5. CADASTRO DE GASTO OU RECEITA:
   - "action": "add_expense"
   - Preencha o objeto "data" com os dados extraídos.
   - Em "descricao", coloque um título curto e objetivo (ex: "Ferragista", "Padaria", "Bebidas").
   - Em "notas", capture qualquer detalhe, observação ou especificação dita pelo usuário. Se não houver, deixe "".
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
