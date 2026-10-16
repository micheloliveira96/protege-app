import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

export default function App() {
  const [screen, setScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = {
    login: ["Bem-vindo à PROTEGE", "Entre na sua conta para gerir os seus equipamentos."],
    register: ["Criar conta", "Registe-se para começar a proteger os seus equipamentos."],
    reset: ["Recuperar palavra-passe", "Indique o seu email para recuperar o acesso."]
  };

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    if (!supabase) {
      setNotice("A ligação ao Supabase não está configurada. Verifique as variáveis de ambiente da Vercel.");
      return;
    }
    setLoading(true);
    try {
      if (screen === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setNotice("Sessão iniciada com sucesso. A área de gestão dos equipamentos ainda está em desenvolvimento.");
      } else if (screen === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setPassword("");
        setScreen("login");
        setNotice(data.session
          ? "Conta criada com sucesso. Já pode entrar na PROTEGE."
          : "Conta criada. Verifique o seu email e carregue no link de confirmação antes de entrar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setNotice("Se existir uma conta associada a esse email, receberá instruções para recuperar a palavra-passe.");
      }
    } catch (error) {
      const message = error?.message || "Ocorreu um erro. Tente novamente.";
      setNotice(message.toLowerCase().includes("invalid login credentials")
        ? "Email ou palavra-passe incorretos."
        : message);
    } finally {
      setLoading(false);
    }
  }

  function changeScreen(next) {
    setScreen(next);
    setPassword("");
    setNotice("");
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
          <input id="email" type="email" autoComplete="email" placeholder="nome@exemplo.pt" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
          {screen !== "reset" && <><label htmlFor="password">Palavra-passe</label><input id="password" type="password" autoComplete={screen === "register" ? "new-password" : "current-password"} placeholder="Introduza a sua palavra-passe" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required disabled={loading} /></>}
          {screen === "login" && <div className="forgot-row"><button className="text-button" type="button" onClick={() => changeScreen("reset")} disabled={loading}>Esqueceu-se da palavra-passe?</button></div>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Aguarde..." : screen === "login" ? "Entrar" : screen === "register" ? "Criar conta" : "Enviar instruções"}</button>
          {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
        </form>
        <div className="switch-screen">
          {screen === "login" ? <>Ainda não tem conta? <button className="text-button" type="button" onClick={() => changeScreen("register")} disabled={loading}>Criar conta</button></> :
           screen === "register" ? <>Já tem conta? <button className="text-button" type="button" onClick={() => changeScreen("login")} disabled={loading}>Entrar</button></> :
           <>Lembrou-se da palavra-passe? <button className="text-button" type="button" onClick={() => changeScreen("login")} disabled={loading}>Voltar a entrar</button></>}
        </div>
      </section>
      <footer>PROTEGE · Registo e proteção de equipamentos</footer>
    </main>
  );
}
