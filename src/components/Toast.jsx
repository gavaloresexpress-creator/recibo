import { useEffect, useState } from "react";

export default function Toast({ message, onClear }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onClear, 300);
    }, 2500);
    return () => clearTimeout(t);
  }, [message, onClear]);

  if (!message) return null;

  return (
    <div className={`toast ${visible ? "toast--in" : "toast--out"}`}>
      <span className="toast__icon">✓</span>
      {message}
    </div>
  );
}
