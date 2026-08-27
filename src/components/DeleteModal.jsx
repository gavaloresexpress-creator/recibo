import { AlertTriangle } from "lucide-react";

export default function DeleteModal({ item, onConfirm, onCancel }) {
  if (!item) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(224,82,82,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <AlertTriangle size={20} color="var(--rust)" />
          </div>
          <h2 className="modal__title" id="modal-title">Excluir gasto</h2>
        </div>

        <p className="modal__body">
          Tem certeza que deseja excluir{" "}
          <strong style={{ color: "var(--text)" }}>"{item.descricao}"</strong>?
          {item.parcelas > 1 && (
            <span style={{ display: "block", marginTop: 6 }}>
              Todas as {item.parcelas} parcelas serão removidas.
            </span>
          )}
        </p>

        <div className="modal__actions">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-danger"    onClick={() => onConfirm(item.id)}>Excluir</button>
        </div>
      </div>
    </div>
  );
}
