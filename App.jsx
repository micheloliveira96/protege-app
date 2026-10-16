import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";

const emptyEquipment = {
  name: "",
  category: "Eletrónica",
  brand: "",
  model: "",
  serial_number: "",
  description: "",
  status: "Ativo"
};

const categories = ["Eletrónica", "Informática", "Telemóvel", "Fotografia", "Veículo", "Ferramenta", "Casa", "Outro"];
const statuses = ["Ativo", "Perdido", "Roubado", "Vendido"];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [dashboardNotice, setDashboardNotice] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) loadEquipment();
    else setEquipment([]);
  }, [session?.user?.id]);

  async function loadEquipment() {
    if (!supabase) return;
    setLoadingEquipment(true);
    const { data, error } = await supabase
      .from("equipments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setDashboardNotice("Não foi possível carregar os equipamentos: " + error.message);
    else {
      setEquipment(data || []);
      setDashboardNotice("");
    }
    setLoadingEquipment(false);
  }

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
      } else if (screen === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setPassword("");
        if (data.session) {
          setNotice("Conta criada com sucesso. Já pode começar a registar os seus equipamentos.");
        } else {
          setScreen("login");
          setNotice("Conta criada. Verifique o seu email e carregue no link de confirmação antes de entrar.");
        }
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

  function startNewEquipment() {
    setEditingId(null);
    setEquipmentForm(emptyEquipment);
    setDashboardNotice("");
    setShowForm(true);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEquipmentForm({
      name: item.name || "",
      category: item.category || "Outro",
      brand: item.brand || "",
      model: item.model || "",
      serial_number: item.serial_number || "",
      description: item.description || "",
      status: item.status || "Ativo"
    });
    setDashboardNotice("");
    setShowForm(true);
  }

  async function saveEquipment(event) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    setLoading(true);
    setDashboardNotice("");
    const payload = {
      ...equipmentForm,
      name: equipmentForm.name.trim(),
      user_id: session.user.id,
      updated_at: new Date().toISOString()
    };
    try {
      const result = editingId
        ? await supabase.from("equipments").update(payload).eq("id", editingId)
        : await supabase.from("equipments").insert(payload);
      if (result.error) throw result.error;
      setShowForm(false);
      setEditingId(null);
      setEquipmentForm(emptyEquipment);
      await loadEquipment();
      setDashboardNotice(editingId ? "Equipamento atualizado." : "Equipamento registado com sucesso.");
    } catch (error) {
      setDashboardNotice("Não foi possível guardar: " + (error?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  async function deleteEquipment(item) {
    if (!supabase || !window.confirm("Tem a certeza de que pretende eliminar «" + item.name + "»?")) return;
    setDashboardNotice("");
    const { error } = await supabase.from("equipments").delete().eq("id", item.id);
    if (error) setDashboardNotice("Não foi possível eliminar: " + error.message);
    else {
      setEquipment(current => current.filter(entry => entry.id !== item.id));
      setDashboardNotice("Equipamento eliminado.");
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setShowForm(false);
    setDashboardNotice("");
    setNotice("");
  }

  const filteredEquipment = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return equipment;
    return equipment.filter(item =>
      [item.name, item.category, item.brand, item.model, item.serial_number, item.status]
        .some(value => (value || "").toLowerCase().includes(term))
    );
  }, [equipment, search]);

  if (session?.user) {
    const counts = {
      total: equipment.length,
      active: equipment.filter(item => item.status === "Ativo").length,
      alert: equipment.filter(item => ["Perdido", "Roubado"].includes(item.status)).length
    };
    return (
      <main className="dashboard-shell">
        <header className="dashboard-topbar">
          <div className="dashboard-brand">
            <div className="brand-mark small-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div>
            <div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Registo e proteção de equipamentos</div></div>
          </div>
          <div className="user-actions"><span className="user-email">{session.user.email}</span><button className="outline-button" onClick={signOut}>Terminar sessão</button></div>
        </header>

        <section className="dashboard-content">
          <div className="dashboard-welcome">
            <div><p className="eyebrow">PAINEL DE CONTROLO</p><h1>Os meus equipamentos</h1><p className="muted-copy">Organize os seus bens e mantenha os dados importantes num só lugar.</p></div>
            <button className="primary-button add-button" onClick={startNewEquipment}>＋ Registar equipamento</button>
          </div>

          <div className="stats-grid">
            <article className="stat-card"><span>Total de equipamentos</span><strong>{counts.total}</strong></article>
            <article className="stat-card"><span>Ativos</span><strong>{counts.active}</strong></article>
            <article className="stat-card"><span>Perdidos ou roubados</span><strong>{counts.alert}</strong></article>
          </div>

          {dashboardNotice && <p className="dashboard-notice" role="status">{dashboardNotice}</p>}

          {showForm && <section className="equipment-form-card">
            <div className="form-card-heading"><div><h2>{editingId ? "Editar equipamento" : "Registar equipamento"}</h2><p>Preencha os dados que conhece. Pode completar os restantes mais tarde.</p></div><button className="close-button" type="button" onClick={() => setShowForm(false)} aria-label="Fechar">×</button></div>
            <form className="equipment-form" onSubmit={saveEquipment}>
              <div className="field-grid">
                <div className="field-full"><label htmlFor="eq-name">Nome do equipamento *</label><input id="eq-name" value={equipmentForm.name} onChange={e => setEquipmentForm({...equipmentForm, name:e.target.value})} placeholder="Ex.: iPhone 15, portátil, bicicleta" required maxLength={120}/></div>
                <div><label htmlFor="eq-category">Categoria</label><select id="eq-category" value={equipmentForm.category} onChange={e => setEquipmentForm({...equipmentForm, category:e.target.value})}>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
                <div><label htmlFor="eq-status">Estado</label><select id="eq-status" value={equipmentForm.status} onChange={e => setEquipmentForm({...equipmentForm, status:e.target.value})}>{statuses.map(value => <option key={value}>{value}</option>)}</select></div>
                <div><label htmlFor="eq-brand">Marca</label><input id="eq-brand" value={equipmentForm.brand} onChange={e => setEquipmentForm({...equipmentForm, brand:e.target.value})} placeholder="Ex.: Apple" maxLength={100}/></div>
                <div><label htmlFor="eq-model">Modelo</label><input id="eq-model" value={equipmentForm.model} onChange={e => setEquipmentForm({...equipmentForm, model:e.target.value})} placeholder="Ex.: iPhone 15 Pro" maxLength={100}/></div>
                <div className="field-full"><label htmlFor="eq-serial">Número de série (opcional)</label><input id="eq-serial" value={equipmentForm.serial_number} onChange={e => setEquipmentForm({...equipmentForm, serial_number:e.target.value})} placeholder="Introduza o número de série" maxLength={160}/></div>
                <div className="field-full"><label htmlFor="eq-description">Notas / descrição</label><textarea id="eq-description" rows="3" value={equipmentForm.description} onChange={e => setEquipmentForm({...equipmentForm, description:e.target.value})} placeholder="Características, acessórios ou outros detalhes" maxLength={1500}/></div>
              </div>
              <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={loading}>{loading ? "A guardar..." : editingId ? "Guardar alterações" : "Guardar equipamento"}</button></div>
            </form>
          </section>}

          <section className="equipment-list-card">
            <div className="list-heading"><div><h2>Equipamentos registados</h2><p>{equipment.length} {equipment.length === 1 ? "equipamento" : "equipamentos"} na sua conta</p></div><input className="search-input" aria-label="Pesquisar equipamentos" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}/></div>
            {loadingEquipment ? <div className="empty-state">A carregar os seus equipamentos...</div> :
              filteredEquipment.length === 0 ? <div className="empty-state"><div className="empty-icon">⌕</div><h3>{equipment.length ? "Nenhum resultado encontrado" : "Ainda não registou equipamentos"}</h3><p>{equipment.length ? "Experimente pesquisar por outro nome, marca ou número de série." : "Comece por registar o seu primeiro equipamento para ter os dados organizados."}</p>{!equipment.length && <button className="primary-button" onClick={startNewEquipment}>＋ Registar primeiro equipamento</button>}</div> :
              <div className="equipment-table-wrap"><table className="equipment-table"><thead><tr><th>Equipamento</th><th>Categoria</th><th>N.º de série</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{filteredEquipment.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span className="table-subtitle">{[item.brand,item.model].filter(Boolean).join(" · ") || "Sem marca/modelo"}</span></td><td>{item.category}</td><td>{item.serial_number || "—"}</td><td><span className={"status-pill status-" + item.status.toLowerCase()}>{item.status}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => startEdit(item)}>Editar</button><button className="delete-button" onClick={() => deleteEquipment(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div>}
          </section>
          <p className="privacy-note">Os seus equipamentos são privados e associados à sua conta.</p>
        </section>
        <footer>PROTEGE · Registo e proteção de equipamentos</footer>
      </main>
    );
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
