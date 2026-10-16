import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";

const emptyEquipment = {
  name: "", category: "Eletrónica", brand: "", model: "",
  serial_number: "", description: "", status: "Ativo"
};
const categories = ["Eletrónica", "Informática", "Telemóvel", "Fotografia", "Veículo", "Ferramenta", "Casa", "Outro"];
const statuses = ["Ativo", "Perdido", "Roubado", "Vendido"];
const bucketName = "equipment-evidence";

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível preparar a fotografia."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) return reject(new Error("Não foi possível comprimir a fotografia."));
        resolve(blob);
      }, "image/jpeg", 0.78);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Um dos ficheiros selecionados não é uma imagem válida."));
    };
    image.src = objectUrl;
  });
}

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
  const [lookupSerial, setLookupSerial] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadEquipment();
    } else {
      setEquipment([]);
    }
  }, [session?.user?.id]);

  async function loadEquipment() {
    if (!supabase) return;
    setLoadingEquipment(true);
    const { data, error } = await supabase.from("equipments").select("*").order("created_at", { ascending: false });
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
          email, password, options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setPassword("");
        if (data.session) setNotice("Conta criada com sucesso. Já pode começar a registar os seus equipamentos.");
        else {
          setScreen("login");
          setNotice("Conta criada. Verifique o seu email e carregue no link de confirmação antes de entrar.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setNotice("Se existir uma conta associada a esse email, receberá instruções para recuperar a palavra-passe.");
      }
    } catch (error) {
      const message = error?.message || "Ocorreu um erro. Tente novamente.";
      setNotice(message.toLowerCase().includes("invalid login credentials") ? "Email ou palavra-passe incorretos." : message);
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
    setSelectedPhotos([]);
    setExistingPhotos([]);
    setDashboardNotice("");
    setShowForm(true);
  }

  async function startEdit(item) {
    setEditingId(item.id);
    setEquipmentForm({
      name: item.name || "", category: item.category || "Outro", brand: item.brand || "",
      model: item.model || "", serial_number: item.serial_number || "",
      description: item.description || "", status: item.status || "Ativo"
    });
    setSelectedPhotos([]);
    const paths = Array.isArray(item.image_paths) ? item.image_paths : [];
    const signed = await Promise.all(paths.map(async path => {
      const { data } = await supabase.storage.from(bucketName).createSignedUrl(path, 3600);
      return { path, url: data?.signedUrl || "" };
    }));
    setExistingPhotos(signed.filter(photo => photo.url));
    setDashboardNotice("");
    setShowForm(true);
  }

  function addPhotos(event) {
    const files = Array.from(event.target.files || []);
    const available = Math.max(0, 4 - existingPhotos.length - selectedPhotos.length);
    if (files.length > available) {
      setDashboardNotice("Pode guardar no máximo 4 fotografias por equipamento.");
    }
    const valid = files.slice(0, available).filter(file => file.type.startsWith("image/"));
    setSelectedPhotos(current => [...current, ...valid]);
    event.target.value = "";
  }

  function removeExistingPhoto(path) {
    setExistingPhotos(current => current.filter(photo => photo.path !== path));
  }

  async function saveEquipment(event) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    const serial = equipmentForm.serial_number.trim();
    if (serial.length < 3) {
      setDashboardNotice("Introduza um número de série com pelo menos 3 caracteres.");
      return;
    }
    if (existingPhotos.length + selectedPhotos.length < 2 || existingPhotos.length + selectedPhotos.length > 4) {
      setDashboardNotice("Adicione entre 2 e 4 fotografias do equipamento para guardar o registo.");
      return;
    }
    setLoading(true);
    setDashboardNotice("");
    let equipmentId = editingId;
    try {
      const payload = {
        ...equipmentForm, name: equipmentForm.name.trim(), serial_number: serial,
        user_id: session.user.id, updated_at: new Date().toISOString()
      };
      if (editingId) {
        const { error } = await supabase.from("equipments").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("equipments").insert(payload).select("id").single();
        if (error) throw error;
        equipmentId = data.id;
      }
      const uploadedPaths = [];
      for (const file of selectedPhotos) {
        const blob = await compressPhoto(file);
        if (blob.size > 2 * 1024 * 1024) throw new Error("Uma fotografia continua acima de 2 MB. Escolha uma imagem mais pequena.");
        const path = session.user.id + "/" + equipmentId + "/" + crypto.randomUUID() + ".jpg";
        const { error } = await supabase.storage.from(bucketName).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
      }
      const paths = [...existingPhotos.map(photo => photo.path), ...uploadedPaths];
      const { error: imageError } = await supabase.from("equipments").update({ image_paths: paths }).eq("id", equipmentId);
      if (imageError) throw imageError;
      setShowForm(false);
      setEditingId(null);
      setEquipmentForm(emptyEquipment);
      setSelectedPhotos([]);
      setExistingPhotos([]);
      await loadEquipment();
      setDashboardNotice(editingId ? "Equipamento atualizado com sucesso." : "Equipamento registado com sucesso.");
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

  async function lookupEquipment(event) {
    event.preventDefault();
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const serial = lookupSerial.trim();
      if (serial.length < 3) throw new Error("Introduza um número de série válido.");
      const { data, error } = await supabase.functions.invoke("lookup-equipment", { body: { serial_number: serial } });
      if (error) throw error;
      setLookupResult(data);
    } catch (error) {
      setLookupResult({ error: error?.message || "Não foi possível concluir a consulta. Tente novamente." });
    } finally {
      setLookupLoading(false);
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
    return equipment.filter(item => [item.name, item.category, item.brand, item.model, item.serial_number, item.status]
      .some(value => (value || "").toLowerCase().includes(term)));
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
            <div><p className="eyebrow">PAINEL DE CONTROLO</p><h1>{activeTab === "mine" ? "Os meus equipamentos" : "Consultar equipamento"}</h1><p className="muted-copy">Organize os seus bens e consulte o estado de proteção dos equipamentos.</p></div>
            {activeTab === "mine" && <button className="primary-button add-button" onClick={startNewEquipment}>＋ Registar equipamento</button>}
          </div>
          <nav className="dashboard-tabs" aria-label="Secções da PROTEGE">
            <button className={"dashboard-tab " + (activeTab === "mine" ? "active" : "")} onClick={() => setActiveTab("mine")}>Os meus equipamentos</button>
            <button className={"dashboard-tab " + (activeTab === "lookup" ? "active" : "")} onClick={() => setActiveTab("lookup")}>Consultar equipamento</button>
          </nav>
          {dashboardNotice && <p className="dashboard-notice" role="status">{dashboardNotice}</p>}

          {activeTab === "mine" && <>
            <div className="stats-grid">
              <article className="stat-card"><span>Total de equipamentos</span><strong>{counts.total}</strong></article>
              <article className="stat-card"><span>Ativos</span><strong>{counts.active}</strong></article>
              <article className="stat-card"><span>Perdidos ou roubados</span><strong>{counts.alert}</strong></article>
            </div>
            {showForm && <section className="equipment-form-card">
              <div className="form-card-heading"><div><h2>{editingId ? "Editar equipamento" : "Registar equipamento"}</h2><p>Preencha os dados e adicione 2 a 4 fotografias como prova do equipamento.</p></div><button className="close-button" type="button" onClick={() => setShowForm(false)} aria-label="Fechar">×</button></div>
              <form className="equipment-form" onSubmit={saveEquipment}>
                <div className="field-grid">
                  <div className="field-full"><label htmlFor="eq-name">Nome do equipamento *</label><input id="eq-name" value={equipmentForm.name} onChange={e => setEquipmentForm({...equipmentForm, name:e.target.value})} placeholder="Ex.: iPhone 15, portátil, bicicleta" required maxLength={120}/></div>
                  <div><label htmlFor="eq-category">Categoria</label><select id="eq-category" value={equipmentForm.category} onChange={e => setEquipmentForm({...equipmentForm, category:e.target.value})}>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
                  <div><label htmlFor="eq-status">Estado</label><select id="eq-status" value={equipmentForm.status} onChange={e => setEquipmentForm({...equipmentForm, status:e.target.value})}>{statuses.map(value => <option key={value}>{value}</option>)}</select></div>
                  <div><label htmlFor="eq-brand">Marca</label><input id="eq-brand" value={equipmentForm.brand} onChange={e => setEquipmentForm({...equipmentForm, brand:e.target.value})} placeholder="Ex.: Apple" maxLength={100}/></div>
                  <div><label htmlFor="eq-model">Modelo</label><input id="eq-model" value={equipmentForm.model} onChange={e => setEquipmentForm({...equipmentForm, model:e.target.value})} placeholder="Ex.: iPhone 15 Pro" maxLength={100}/></div>
                  <div className="field-full"><label htmlFor="eq-serial">Número de série *</label><input id="eq-serial" value={equipmentForm.serial_number} onChange={e => setEquipmentForm({...equipmentForm, serial_number:e.target.value})} placeholder="Introduza o número de série" maxLength={160} required/></div>
                  <div className="field-full"><label htmlFor="eq-description">Notas / descrição</label><textarea id="eq-description" rows="3" value={equipmentForm.description} onChange={e => setEquipmentForm({...equipmentForm, description:e.target.value})} placeholder="Características, acessórios ou outros detalhes" maxLength={1500}/></div>
                  <div className="field-full"><label htmlFor="eq-photos">Fotografias do equipamento * (2 a 4)</label><input id="eq-photos" type="file" accept="image/*" multiple onChange={addPhotos}/><p className="field-help">As fotografias são guardadas num espaço privado. Cada imagem é comprimida antes do envio.</p></div>
                </div>
                {(existingPhotos.length + selectedPhotos.length > 0) && <div className="photo-grid">
                  {existingPhotos.map(photo => <div className="photo-preview" key={photo.path}><img src={photo.url} alt="Fotografia guardada do equipamento"/><button type="button" onClick={() => removeExistingPhoto(photo.path)} aria-label="Remover fotografia">×</button></div>)}
                  {selectedPhotos.map((photo, index) => <div className="photo-preview" key={photo.name + index}><img src={URL.createObjectURL(photo)} alt={photo.name}/><button type="button" onClick={() => setSelectedPhotos(current => current.filter((_, i) => i !== index))} aria-label="Remover fotografia">×</button></div>)}
                </div>}
                <p className="field-help">{existingPhotos.length + selectedPhotos.length} de 4 fotografias selecionadas.</p>
                <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={loading}>{loading ? "A guardar..." : editingId ? "Guardar alterações" : "Guardar equipamento"}</button></div>
              </form>
            </section>}
            <section className="equipment-list-card">
              <div className="list-heading"><div><h2>Equipamentos registados</h2><p>{equipment.length} {equipment.length === 1 ? "equipamento" : "equipamentos"} na sua conta</p></div><input className="search-input" aria-label="Pesquisar equipamentos" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}/></div>
              {loadingEquipment ? <div className="empty-state">A carregar os seus equipamentos...</div> :
                filteredEquipment.length === 0 ? <div className="empty-state"><div className="empty-icon">⌕</div><h3>{equipment.length ? "Nenhum resultado encontrado" : "Ainda não registou equipamentos"}</h3><p>{equipment.length ? "Experimente pesquisar por outro nome, marca ou número de série." : "Comece por registar o seu primeiro equipamento para ter os dados organizados."}</p>{!equipment.length && <button className="primary-button" onClick={startNewEquipment}>＋ Registar primeiro equipamento</button>}</div> :
                <div className="equipment-table-wrap"><table className="equipment-table"><thead><tr><th>Equipamento</th><th>Categoria</th><th>N.º de série</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{filteredEquipment.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span className="table-subtitle">{[item.brand,item.model].filter(Boolean).join(" · ") || "Sem marca/modelo"}</span></td><td>{item.category}</td><td>{item.serial_number || "—"}</td><td><span className={"status-pill status-" + item.status.toLowerCase()}>{item.status}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => startEdit(item)}>Editar</button><button className="delete-button" onClick={() => deleteEquipment(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div>}
            </section>
          </>}

          {activeTab === "lookup" && <section className="equipment-list-card">
            <form className="lookup-form" onSubmit={lookupEquipment}>
              <div className="form-card-heading"><div><h2>Consultar pelo número de série</h2><p>Introduza o número de série para verificar se existe um registo na PROTEGE e se tem alguma restrição.</p></div></div>
              <div className="lookup-input-row"><input aria-label="Número de série para consulta" value={lookupSerial} onChange={e => setLookupSerial(e.target.value)} placeholder="Número de série" minLength={3} maxLength={160} required/><button className="primary-button" type="submit" disabled={lookupLoading}>{lookupLoading ? "A consultar..." : "Consultar"}</button></div>
            </form>
            {lookupResult && (() => {
              const restricted = lookupResult.found && (lookupResult.status === "Roubado" || lookupResult.restriction_status === "Com restrição");
              return <div className={"lookup-result-card " + (lookupResult.error ? "lookup-not-found" : !lookupResult.found ? "lookup-not-found" : restricted ? "restriction-red" : "restriction-green")}>
                {lookupResult.error ? <><strong>Não foi possível consultar</strong><p>{lookupResult.error}</p></> :
                  !lookupResult.found ? <><strong>Nenhum registo encontrado</strong><p>Não foi encontrado um equipamento com esse número de série.</p></> :
                  <><span className="lookup-status">{restricted ? "COM RESTRIÇÃO" : "SEM RESTRIÇÃO"}</span><strong>{lookupResult.name}</strong><p>{restricted ? (lookupResult.status === "Roubado" ? "ATENÇÃO: este equipamento está registado como roubado." : "ATENÇÃO: este equipamento tem uma restrição registada na PROTEGE.") : "Não existe uma restrição assinalada neste registo."}</p></>}
              </div>;
            })()}
          </section>}

          <p className="privacy-note">Os seus equipamentos e fotografias são protegidos por regras de acesso.</p>
        </section>
        <footer>PROTEGE · Registo e proteção de equipamentos</footer>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="login-card">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Registo e proteção de equipamentos</div></div>
        <div className="form-heading"><h1>{copy[screen][0]}</h1><p>{copy[screen][1]}</p></div>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" placeholder="nome@exemplo.pt" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading}/>
          {screen !== "reset" && <><label htmlFor="password">Palavra-passe</label><input id="password" type="password" autoComplete={screen === "register" ? "new-password" : "current-password"} placeholder="Introduza a sua palavra-passe" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required disabled={loading}/></>}
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
