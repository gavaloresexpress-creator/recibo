import { useState } from "react";
import { isConfigured } from "../firebase";

export default function LoginScreen({ onSignIn, error }) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    await onSignIn();
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background decorativo */}
      <div style={{
        position: "absolute",
        top: "-20%",
        left: "-20%",
        width: "60%",
        height: "60%",
        background: "radial-gradient(circle, rgba(230,180,74,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: "-20%",
        right: "-20%",
        width: "60%",
        height: "60%",
        background: "radial-gradient(circle, rgba(91,141,239,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Card de login */}
      <div style={{
        width: "100%",
        maxWidth: 380,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "36px 28px 32px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        position: "relative",
        textAlign: "center",
      }}>
        {/* Ícone / Logo */}
        <div style={{
          width: 68,
          height: 68,
          borderRadius: 20,
          background: "linear-gradient(135deg, #E6B44A 0%, #C9922B 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 8px 24px rgba(230,180,74,0.35)",
        }}>
          <span style={{ 
            fontFamily: "'Fraunces', Georgia, serif", 
            fontSize: 40, 
            fontWeight: "bold", 
            color: "#1A1000", 
            transform: "translateY(2px)" 
          }}>
            R
          </span>
        </div>

        {/* Título */}
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #E6B44A 0%, #F5D07A 50%, #C9922B 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          margin: "0 0 6px",
        }}>
          Recibo
        </h1>

        <p style={{
          color: "var(--text-muted)",
          fontSize: 14,
          margin: "0 0 28px",
          lineHeight: 1.5,
        }}>
          Controle seus gastos e cartões.<br />
          Seus dados ficam seguros na nuvem.
        </p>

        {/* Aviso se não configurado */}
        {!isConfigured && (
          <div style={{
            background: "rgba(224,82,82,0.1)",
            border: "1px solid rgba(224,82,82,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 12,
            color: "#F07070",
            textAlign: "left",
            lineHeight: 1.6,
          }}>
            ⚠️ <strong>Firebase não configurado.</strong><br />
            Preencha o arquivo <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 4 }}>.env</code> com as credenciais do seu projeto Firebase.
          </div>
        )}

        {/* Erro de auth */}
        {error && (
          <div style={{
            background: "rgba(224,82,82,0.1)",
            border: "1px solid rgba(224,82,82,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#F07070",
          }}>
            {error}
          </div>
        )}

        {/* Botão Google */}
        <button
          id="btn-login-google"
          onClick={handleSignIn}
          disabled={loading || !isConfigured}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: loading ? "rgba(255,255,255,0.05)" : "#fff",
            color: "#1A1A2E",
            border: "none",
            borderRadius: 10,
            padding: "13px 20px",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || !isConfigured ? "not-allowed" : "pointer",
            opacity: loading || !isConfigured ? 0.6 : 1,
            transition: "all 0.2s ease",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => {
            if (!loading && isConfigured) e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {/* Logo Google SVG */}
          {loading ? (
            <div style={{
              width: 20, height: 20,
              border: "2px solid #ddd",
              borderTopColor: "#4285F4",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
              flexShrink: 0,
            }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Entrando..." : "Entrar com Google"}
        </button>

        {/* Rodapé */}
        <p style={{
          fontSize: 11,
          color: "var(--text-dim)",
          marginTop: 20,
          lineHeight: 1.6,
        }}>
          Ao entrar, você concorda que seus dados serão armazenados de forma segura no Firebase (Google Cloud).
          Cada usuário acessa apenas seus próprios dados.
        </p>
      </div>

      {/* Features abaixo */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        marginTop: 24,
        width: "100%",
        maxWidth: 380,
      }}>
        {[
          { icon: "☁️", text: "Dados na nuvem" },
          { icon: "🔒", text: "100% seguro" },
          { icon: "📱", text: "Qualquer device" },
        ].map(({ icon, text }) => (
          <div key={text} style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 8px",
            textAlign: "center",
            fontSize: 11,
            color: "var(--text-muted)",
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
