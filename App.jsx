
import React from "react";

export default function App() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      <section style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
        <div style={{
          width: "72px",
          height: "72px",
          borderRadius: "20px",
          background: "#2563eb",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 24px",
          fontSize: "32px",
          fontWeight: "bold"
        }}>P</div>

        <h1 style={{ fontSize: "42px" }}>PROTEGE</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
          A plataforma de registo e proteção dos teus equipamentos em Portugal.
        </p>
        <button
          onClick={() => alert("Bem-vindo ao PROTEGE!")}
          style={{
            marginTop: "24px",
            padding: "14px 28px",
            border: "none",
            borderRadius: "10px",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "16px",
            cursor: "pointer"
          }}
        >
          Começar
        </button>
        <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "40px" }}>
          PROTEGE · Registo e proteção de equipamentos
        </p>
      </section>
    </main>
  );
}
