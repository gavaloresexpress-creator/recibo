export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API Key não configurada no servidor." });
  }

  const { text, categories, cards, expenses, clientDate } = req.body;
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

    const prompt = `Você é um assistente financeiro inteligente e preciso de um aplicativo chamado "Recibo".
O usuário disse o seguinte comando ou pergunta por voz: "${text}"

CONTEXTO DO USUÁRIO:
- Data de hoje: ${today} (formato YYYY-MM-DD)
- Mês atual: ${currentMonthPrefix}
- Categorias disponíveis: ${categoryNames}
- Cartões disponíveis: ${cardNames}
- Histórico de lançamentos cadastrados (${recentExpenses.length} transações):
${JSON.stringify(recentExpenses)}

INSTRUÇÕES CRÍTICAS:
1. CONSULTAS E PERGUNTAS (ex: "quanto gastei...", "quanto sobrou...", "qual foi o valor de...", "quantos reais tive de gasto..."):
   - "action": "answer"
   - "data": null
   - Verifique cuidadosamente a lista de lançamentos fornecida acima.
   - Para perguntas sobre o mês atual ou "esse mês", filtre lançamentos cuja "data" comece com "${currentMonthPrefix}".
   - "despesa" representa saídas/gastos. "receita" representa entradas/ganhos.
   - Calcule a soma com exatidão e responda no campo "message" de forma curta, natural e amigável em português, informando o valor formatado em Reais (ex: R$ 1.250,00).

2. CADASTRO DE GASTO OU RECEITA (ex: "gastei 50 na padaria no débito", "recebi 200 de pix"):
   - "action": "add_expense"
   - Preencha o objeto "data" com os dados extraídos.
   - Use a data de hoje (${today}) se nenhuma data for mencionada.
   - No campo "message", confirme o lançamento de forma amigável e curta.

Retorne APENAS um objeto JSON válido (sem markdown, sem texto fora do JSON):
{
  "action": "add_expense" ou "answer",
  "data": {
    "valor": (número, ex: 50.5),
    "descricao": (string, título curto),
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
