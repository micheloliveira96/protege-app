import React, { useState } from "react";

export default function App() {
  const [screen, setScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  const copy = {
    login: ["Bem-vindo à PROTEGE", "Entre na sua conta para gerir os seus equipamentos."],
    register: ["Criar conta", "Registe-se para começar a proteger os seus equipamentos."],
    reset: ["Recuperar palavra-passe", "Indique o seu email para recuperar o acesso."]
  };

  function submit(event) {
    event.preventDefault();
    setNotice("A autenticação ainda não está ligada. Não é possível iniciar sessão ou criar uma conta nesta versão.");
  }

  return (
    <main className="page-shell">
      <section className="login-card">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div>
          <div className="brand-name">PROTEGE</div>
          <div className="brand-tagline">Registo e proteção de equipamentos</div>
        </div>
        <div className="form-heading"><h1>{copy[screen][0]}</h1><p>{copy[screen][1]}</p></div>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="nome@exemplo.pt" value={email} onChange={e => setEmail(e.target.value)} required />
          {screen !== "reset" && <><label htmlFor="password">Palavra-passe</label><input id="password" type="password" autoComplete={screen === "register" ? "new-password" : "current-password"} placeholder="Introduza a sua palavra-passe" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required /></>}
          {screen === "login" && <div className="forgot-row"><button className="text-button" type="button" onClick={() => {setScreen("reset");setNotice("");}}>Esqueceu-se da palavra-passe?</button></div>}
          <button className="primary-button" type="submit">{screen === "login" ? "Entrar" : screen === "register" ? "Criar conta" : "Enviar instruções"}</button>
          {notice && <p className="notice" role="status">{notice}</p>}
        </form>
        <div className="switch-screen">
          {screen === "login" ? <>Ainda não tem conta? <button className="text-button" type="button" onClick={() => {setScreen("register");setNotice("");}}>Criar conta</button></> :
           screen === "register" ? <>Já tem conta? <button className="text-button" type="button" onClick={() => {setScreen("login");setNotice("");}}>Entrar</button></> :
           <>Lembrou-se da palavra-passe? <button className="text-button" type="button" onClick={() => {setScreen("login");setNotice("");}}>Voltar a entrar</button></>}
        </div>
      </section>
      <footer>PROTEGE · Registo e proteção de equipamentos</footer>
    </main>
  );
}