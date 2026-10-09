import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Aceita apenas POST
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

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

Aqui estão os dados estruturais do usuário para você mapear:
Categorias disponíveis: ${categoryNames}
Cartões disponíveis: ${cardNames}
Data de hoje: ${new Date().toISOString().slice(0, 10)}

Gastos/receitas do usuário no mês atual (use para responder perguntas):
${JSON.stringify(recentExpenses)}

Retorne APENAS um objeto JSON válido com a exata estrutura abaixo (sem texto adicional):
{
  "action": "add_expense" ou "answer",
  "data": {
    "valor": (número extraído, ex: 50.5),
    "descricao": (string, título curto da transação),
    "categoria": (string, nome de uma das categorias disponíveis, ou "Outros"),
    "cartao": (string, nome de um dos cartões, ou "" se não usou cartão de crédito),
    "formaPagamento": (string: "credito", "debito", "pix" ou "dinheiro"),
    "tipo": (string: "despesa" ou "receita"),
    "data": (string: YYYY-MM-DD, data da compra)
  },
  "message": (string, sua resposta para o usuário. Seja curto, claro e amigável. Se cadastrou algo, confirme. Se for pergunta de gastos, faça os cálculos e responda com os valores.)
}

Regras importantes:
- Preencha "data" somente se action for "add_expense", caso contrário coloque null.
- Se o usuário fizer uma pergunta sobre gastos, use action "answer" e calcule com os dados fornecidos.
- Se o usuário pedir para adicionar algo, use action "add_expense".`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonStr = response.text();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: "A IA retornou um formato inválido." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Gemini API error:", err);
    return res.status(500).json({ error: err.message || "Erro ao chamar a IA." });
  }
}
