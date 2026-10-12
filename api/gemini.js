export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API Key não configurada no servidor." });
  }

  const { text, categories, cards, expenses } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Texto do comando é obrigatório." });
  }

  try {
    const categoryNames = (categories || []).map((c) => c.label).join(", ");
    const cardNames = (cards || []).map((c) => (typeof c === "object" ? c.name : c)).join(", ");
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const recentExpenses = (expenses || [])
      .filter((e) => e.date && e.date.startsWith(currentMonthPrefix))
      .map((e) => ({
        data: e.date,
        desc: e.descricao,
        cat: e.categoria,
        valor: e.valor,
        tipo: e.tipo,
      }));

    const prompt = `Você é um assistente financeiro inteligente de um aplicativo chamado "Recibo".
O usuário disse o seguinte comando de voz: "${text}"

Dados do usuário:
Categorias disponíveis: ${categoryNames}
Cartões disponíveis: ${cardNames}
Data de hoje: ${new Date().toISOString().slice(0, 10)}
Gastos do mês atual: ${JSON.stringify(recentExpenses)}

Retorne APENAS um objeto JSON válido (sem markdown, sem texto adicional):
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
}

Regras: preencha "data" apenas se action for "add_expense", caso contrário coloque null. Para perguntas, calcule com os dados fornecidos.`;

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
