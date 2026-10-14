import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader, MessageSquare, Send } from "lucide-react";
import { getInvoiceMonth } from "../utils/format";

export default function GeminiAssistant({ expenses, categories, cards, paidInvoices, addExpense }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const recognitionRef = useRef(null);

  // Refs para sempre ter o estado mais atualizado dentro de callbacks (resolve stale closure)
  const expensesRef = useRef(expenses);
  const categoriesRef = useRef(categories);
  const cardsRef = useRef(cards);
  const paidInvoicesRef = useRef(paidInvoices);
  const addExpenseRef = useRef(addExpense);

  useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { paidInvoicesRef.current = paidInvoices; }, [paidInvoices]);
  useEffect(() => { addExpenseRef.current = addExpense; }, [addExpense]);

  useEffect(() => {
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
        const result = event.results[event.resultIndex][0].transcript;
        setTranscript(result);
        handleCommand(result);
      };

      recognition.onerror = (e) => {
        setIsListening(false);
        const msg = e.error === "not-allowed"
          ? "Permissão de microfone negada."
          : e.error === "network"
          ? "Erro de rede no reconhecimento de voz."
          : "Erro ao ouvir. Tente digitar abaixo.";
        setFeedback(msg);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setFeedback("Seu navegador não suporta reconhecimento de voz. Use o campo de texto abaixo.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      setFeedback("");
      try {
        recognitionRef.current.start();
      } catch (e) {
        setFeedback("Não foi possível iniciar o microfone. Use o campo de texto abaixo.");
      }
    }
  };

  const handleCommand = async (text) => {
    if (!text || !text.trim()) return;
    setIsProcessing(true);
    setFeedback("Pensando...");

    // Usa os refs para garantir dados sempre frescos (resolve stale closure)
    const currentExpenses = expensesRef.current;
    const currentCategories = categoriesRef.current;
    const currentCards = cardsRef.current;
    const currentPaidInvoices = paidInvoicesRef.current;

    try {
      const clientDate = new Date().toLocaleDateString("en-CA");
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          categories: currentCategories,
          cards: currentCards,
          expenses: currentExpenses,
          paidInvoices: currentPaidInvoices,
          clientDate,
        }),
      });

      const parsed = await res.json();

      if (!res.ok) {
        throw new Error(parsed.error || "Erro desconhecido no servidor.");
      }

      if (parsed.action === "add_expense" && parsed.data) {
        // Mapeia categoria: nome → key
        const catObj = currentCategories.find(
          (c) => c.label.toLowerCase() === (parsed.data.categoria || "").toLowerCase()
        );
        parsed.data.categoria = catObj ? catObj.key : (currentCategories[0]?.key || "outros");

        // Mapeia cartão: nome → id
        let cObj = null;
        if (parsed.data.cartao) {
          cObj = currentCards.find((c) => {
            const name = typeof c === "string" ? c : c.name;
            return name.toLowerCase() === parsed.data.cartao.toLowerCase();
          });
          if (cObj) parsed.data.cartao = cObj.id || cObj;
          else parsed.data.cartao = null;
        }

        // Campos obrigatórios
        parsed.data.isRecurring = false;
        parsed.data.parcelas = 1;
        parsed.data.notas = (parsed.data.notas && parsed.data.notas.trim()) ? parsed.data.notas.trim() : "Via Assistente IA";
        parsed.data.mesInicioParcelas = null;

        // Calcula mês da fatura se for crédito usando a regra oficial do app
        if (parsed.data.formaPagamento === "credito" && parsed.data.tipo === "despesa" && cObj) {
          parsed.data.mesInicioParcelas = getInvoiceMonth(parsed.data.data, cObj);
        }

        await addExpenseRef.current(parsed.data);
      }

      setFeedback(parsed.message || "Feito!");
      setTextInput("");

      // Resposta em voz
      if ("speechSynthesis" in window && parsed.message) {
        try {
          window.speechSynthesis.cancel(); // Para qualquer fala anterior
          const utterance = new SpeechSynthesisUtterance(parsed.message);
          utterance.lang = "pt-BR";
          window.speechSynthesis.speak(utterance);
        } catch (speechErr) {
          console.warn("speechSynthesis error:", speechErr);
        }
      }
    } catch (e) {
      console.error("Assistant error:", e);
      setFeedback(e.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    setTranscript(textInput.trim());
    handleCommand(textInput.trim());
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Assistente IA"
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
          boxShadow: "0 4px 16px rgba(230,180,74,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 100,
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(230,180,74,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(230,180,74,0.4)";
        }}
      >
        <MessageSquare size={24} />
      </button>

      {/* Modal do assistente */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "150px",
            right: "20px",
            width: "300px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            zIndex: 101,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--gold)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
              ✨ Assistente IA
            </h3>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>

          <p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.5", margin: 0 }}>
            Fale ou digite um comando:<br />
            <em>"Gastei R$ 30 de padaria no crédito"</em> ou <em>"Quanto gastei com mercado?"</em>
          </p>

          <div
            style={{
              background: "var(--overlay-dark)",
              padding: "12px",
              borderRadius: "10px",
              minHeight: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
            }}
          >
            {transcript ? (
              <p style={{ fontSize: "13px", color: "var(--text)", textAlign: "center", fontStyle: "italic", margin: 0 }}>
                "{transcript}"
              </p>
            ) : (
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0 }}>Seu comando aparecerá aqui...</p>
            )}
          </div>

          {feedback && (
            <p style={{
              fontSize: "12px",
              color: (feedback.startsWith("Erro") || feedback.startsWith("Permissão") || feedback.startsWith("Não foi"))
                ? "var(--rust)" : "var(--sage)",
              textAlign: "center",
              fontWeight: "600",
              margin: 0,
              lineHeight: 1.4,
            }}>
              {feedback}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "center" }}>
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
                transition: "all 0.2s",
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              {isProcessing ? <Loader size={24} className="spin" /> : isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
          </div>
          {/* Input de texto (fallback e alternativa ao microfone) */}
          <form onSubmit={handleTextSubmit} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ou digite aqui..."
              disabled={isProcessing}
              style={{
                flex: 1,
                background: "var(--overlay-dark)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "var(--text)",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isProcessing || !textInput.trim()}
              style={{
                background: "var(--gold)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 10px",
                color: "var(--bg-dark)",
                cursor: isProcessing || !textInput.trim() ? "not-allowed" : "pointer",
                opacity: isProcessing || !textInput.trim() ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.2s",
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
