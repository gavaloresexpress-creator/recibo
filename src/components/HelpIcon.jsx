import { useState } from "react";
import { Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HelpIcon({ text }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        type="button" 
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        style={{ 
          background: "transparent", border: "none", color: "var(--text-dim)", 
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: 2, marginLeft: 6, verticalAlign: "middle"
        }}
        title="Ajuda"
      >
        <Info size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20
          }}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "var(--backdrop)", backdropFilter: "blur(2px)" }}
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "relative",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 20,
                maxWidth: 320,
                width: "100%",
                boxShadow: "var(--shadow-modal)",
                color: "var(--text)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold)" }}>
                  <Info size={18} />
                  <span style={{ fontWeight: 600 }}>Sobre este recurso</span>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, margin: -4 }}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5, margin: 0, whiteSpace: "normal" }}>
                {text}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
