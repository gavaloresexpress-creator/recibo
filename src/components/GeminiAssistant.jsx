import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader, MessageSquare } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export default function GeminiAssistant({ expenses, categories, cards, addExpense }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const recognitionRef = useRef(null);

  useEffect(() => {
    // Setup Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = "pt-BR";
      
      recognition.onstart = () => {
        setIsListening(true);
        setFeedback("Ouvindo...");
      };
      
      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        setTranscript(result);
        handleVoiceCommand(result);
      };
      
      recognition.onerror = (event) => {
        setIsListening(false);
        setFeedback("Erro ao ouvir. Tente novamente.");
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setFeedback("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      recognitionRef.current.start();
    }
  };

  const handleVoiceCommand = async (text) => {
    if (!text) return;
    setIsProcessing(true);
    setFeedback("Pensando...");

    if (!API_KEY) {
      setFeedback("Erro: A API Key (VITE_GEMINI_API_KEY) não está configurada.");
      setIsProcessing(false);
      return;
    }

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", 
        generationConfig: { responseMimeType: "application/json" } 
      });

      // Pega apenas os gastos do mês atual para não exceder o limite de contexto
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      const recentExpenses = expenses
        .filter(e => e.date && e.date.startsWith(currentMonthPrefix))
        .map(e => ({ data: e.date, desc: e.description, cat: e.category, valor: e.value, tipo: e.type }));
      
      const prompt = `Você é um assistente financeiro inteligente de um aplicativo chamado "Recibo".
      O usuário disse o seguinte comando de voz: "${text}"

      Aqui estão os dados estruturais do usuário para você mapear:
      Categorias disponíveis: ${categories.map(c => c.label).join(", ")}
      Cartões disponíveis: ${cards.map(c => typeof c === 'object' ? c.name : c).join(", ")}
      Data de hoje: ${new Date().toISOString().slice(0, 10)}
      
      E aqui está o resumo dos gastos/receitas do usuário no mês atual (para você responder perguntas):
      ${JSON.stringify(recentExpenses)}

      Seu objetivo é analisar o comando e retornar APENAS um objeto JSON válido com a exata estrutura abaixo:
      {
        "action": "add_expense" ou "answer",
        "data": { // Preencha SOMENTE SE action for "add_expense"
           "valor": (número extraído, ex: 50.5),
           "descricao": (string, um título curto para a transação),
           "categoria": (string, tente mapear para a key de uma das categorias disponíveis, ou use "outros"),
           "cartao": (string, tente mapear para um dos cartões, ou deixe vazio se não usou cartão),
           "formaPagamento": (string, "credito", "debito", "pix" ou "dinheiro"),
           "tipo": (string, "despesa" ou "receita"),
           "data": (string, YYYY-MM-DD, a data da compra)
        },
        "message": (string, a sua resposta falada para o usuário. Seja bem curto, claro e amigável. Se for uma resposta a uma pergunta de gastos, calcule usando os dados fornecidos e responda. Se você cadastrou um gasto, confirme de forma natural.)
      }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonStr = response.text();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        throw new Error("A IA retornou um formato inválido.");
      }

      if (parsed.action === "add_expense" && parsed.data) {
        // Mapeia Categoria para Key
        const catObj = categories.find(c => c.label.toLowerCase() === (parsed.data.categoria || "").toLowerCase());
        if (catObj) parsed.data.categoria = catObj.key;
        else parsed.data.categoria = categories.length > 0 ? categories[0].key : "outros";
        
        // Mapeia Cartão para ID
        let cObj = null;
        if (parsed.data.cartao) {
          cObj = cards.find(c => {
            const name = typeof c === 'string' ? c : c.name;
            return name.toLowerCase() === parsed.data.cartao.toLowerCase();
          });
          if (cObj) parsed.data.cartao = cObj.id || cObj;
        }

        // Garante os campos obrigatórios
        parsed.data.isRecurring = false;
        parsed.data.parcelas = 1;
        parsed.data.notas = "Via Assistente IA";

        if (parsed.data.formaPagamento === "credito" && parsed.data.tipo === "despesa" && cObj) {
          const [ano, mes, dia] = parsed.data.data.split("-").map(Number);
          const dataCompra = new Date(ano, mes - 1, dia);
          let faturaMes = mes;
          let faturaAno = ano;
          
          if (dia >= (cObj.fechamento || 25)) {
            faturaMes++;
            if (faturaMes > 12) { faturaMes = 1; faturaAno++; }
          }
          parsed.data.mesInicioParcelas = `${faturaAno}-${String(faturaMes).padStart(2, '0')}`;
        }
        
        await addExpense(parsed.data);
      }

      setFeedback(parsed.message);

      // Faz o app falar a resposta
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(parsed.message);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
      }

    } catch (e) {
      console.error(e);
      setFeedback(e.message || "Ocorreu um erro de conexão com a IA.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "80px",
          right: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--gold) 0%, #F5D07A 100%)",
          color: "var(--bg-dark)",
          border: "none",
          boxShadow: "0 4px 12px rgba(230,180,74,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 100,
          transition: "transform 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <MessageSquare size={24} />
      </button>

      {/* Assistant Modal */}
      {isOpen && (
        <div style={{
          position: "fixed",
          bottom: "150px",
          right: "20px",
          width: "300px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "var(--shadow-card)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--gold)", display: "flex", alignItems: "center", gap: "8px" }}>
              ✨ Assistente IA
            </h3>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: "1.4" }}>
            Toque no microfone e diga algo como:<br/> 
            <em>"Adicione um gasto de 30 reais com padaria"</em> ou <em>"Quanto gastei com mercado?"</em>
          </p>

          <div style={{ background: "var(--overlay-dark)", padding: "12px", borderRadius: "8px", minHeight: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {transcript ? (
              <p style={{ fontSize: "14px", color: "var(--text)", textAlign: "center", fontStyle: "italic" }}>"{transcript}"</p>
            ) : (
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Seu comando aparecerá aqui...</p>
            )}
          </div>

          <p style={{ fontSize: "12px", color: "var(--sage)", textAlign: "center", fontWeight: "600" }}>{feedback}</p>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
            <button 
              onClick={toggleListen}
              disabled={isProcessing}
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: isListening ? "rgba(224, 82, 82, 0.15)" : "var(--overlay-dark)",
                border: isListening ? "2px solid var(--rust)" : "1px solid var(--border)",
                color: isListening ? "var(--rust)" : "var(--text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isProcessing ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }}
            >
              {isProcessing ? <Loader size={24} className="spin" /> : (isListening ? <MicOff size={24} /> : <Mic size={24} />)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
