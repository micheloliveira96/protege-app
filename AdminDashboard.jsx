import React, { useEffect, useState } from "react";

export default function AdminDashboard({ supabase, user, onSignOut, onManageAccess }) {
  const [section, setSection] = useState("equipment");
  const [role, setRole] = useState("admin");
  const [equipment, setEquipment] = useState([]);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(action) {
    setLoading(true); setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-dashboard", { body: { action } });
      if (invokeError) throw new Error(data?.error || invokeError.message || "Não foi possível carregar os dados.");
      if (data?.error) throw new Error(data.error);
      setRole(data.role || "admin");
      if (action === "equipment") setEquipment(data.equipment || []);
      if (action === "history") setHistory(data.history || []);
    } catch (e) { setError(e.message || "Não foi possível carregar os dados administrativos."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load("equipment"); }, []);
  const term = filter.trim().toLowerCase();
  const filteredEquipment = equipment.filter(item => [item.name,item.brand,item.model,item.category,item.serial_number,item.status,item.restriction_status,item.owner_name,item.owner_phone].some(v => String(v || "").toLowerCase().includes(term)));
  const filteredHistory = history.filter(item => [item.searcher_label,item.searcher_email,item.serial_searched,item.equipment_name,item.equipment_status,item.restriction_status,item.owner_name,item.owner_phone].some(v => String(v || "").toLowerCase().includes(term)));

  return <main className="dashboard-shell admin-shell">
    <header className="dashboard-topbar">
      <div className="dashboard-brand"><div className="brand-mark small-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Administração privada</div></div></div>
      <div className="user-actions"><span className="admin-session-label">Acesso restrito</span><span className="user-email">{user.email}</span><button className="outline-button" onClick={onSignOut}>Terminar sessão</button></div>
    </header>
    <section className="dashboard-content">
      <div className="dashboard-welcome admin-welcome"><div><p className="eyebrow">ÁREA ADMINISTRATIVA</p><h1>{section === "equipment" ? "Equipamentos registados" : "Histórico de pesquisas"}</h1><p className="muted-copy">{section === "equipment" ? "Consulte os equipamentos, fotografias, situação e contacto do proprietário." : "Consulte quem pesquisou, o número de série, o resultado e o proprietário associado."}</p></div></div>
      <nav className="dashboard-tabs admin-nav" aria-label="Secções administrativas">
        <button className={"dashboard-tab " + (section === "equipment" ? "active" : "")} onClick={() => { setSection("equipment"); setFilter(""); load("equipment"); }}>Equipamentos</button>
        <button className={"dashboard-tab " + (section === "history" ? "active" : "")} onClick={() => { setSection("history"); setFilter(""); load("history"); }}>Histórico de pesquisas</button>
        {role === "super_admin" && <button className="dashboard-tab" onClick={onManageAccess}>Gestão de acessos</button>}
      </nav>
      {error && <p className="dashboard-notice admin-error" role="alert">{error}</p>}
      {section === "equipment" && <section className="equipment-list-card admin-data-card">
        <div className="list-heading"><div><h2>Todos os equipamentos</h2><p>{equipment.length} registos encontrados. Fotografias e contactos visíveis apenas a administradores.</p></div><div className="admin-filter-actions"><input className="search-input" aria-label="Pesquisar equipamentos" placeholder="Pesquisar SN, equipamento ou proprietário" value={filter} onChange={e=>setFilter(e.target.value)}/><button className="outline-button" onClick={()=>load("equipment")} disabled={loading}>Atualizar</button></div></div>
        {loading ? <div className="empty-state">A carregar equipamentos...</div> : filteredEquipment.length ? <div className="equipment-table-wrap"><table className="equipment-table admin-table admin-equipment-table"><thead><tr><th>Equipamento / fotografias</th><th>N.º de série</th><th>Situação</th><th>Proprietário</th><th>Telefone</th><th>Registado em</th></tr></thead><tbody>
          {filteredEquipment.map(item=><tr key={item.id}><td><strong>{item.name}</strong><span className="table-subtitle">{[item.brand,item.model,item.category].filter(Boolean).join(" · ")}</span><div className="admin-inline-photos">{(item.photos||[]).map((photo,i)=><a href={photo} target="_blank" rel="noreferrer" key={photo} aria-label={"Abrir fotografia "+(i+1)}><img src={photo} alt={"Fotografia "+(i+1)+" de "+item.name}/></a>)}{!(item.photos||[]).length&&<span className="table-subtitle">Sem fotografias</span>}</div></td><td>{item.serial_number||"—"}</td><td><span className={"status-pill status-"+String(item.status||"").toLowerCase()}>{item.status||"—"}</span><span className={"admin-restriction "+(item.restriction_status==="Com restrição"||item.status==="Roubado"?"admin-restriction-red":"admin-restriction-green")}>{item.status==="Roubado"?"COM RESTRIÇÃO":item.restriction_status||"Sem restrição"}</span></td><td><strong>{item.owner_name}</strong><span className="table-subtitle">{[item.owner_city,item.owner_country].filter(Boolean).join(" · ")}</span></td><td>{item.owner_phone||"—"}</td><td>{item.created_at?new Date(item.created_at).toLocaleString("pt-PT"):"—"}</td></tr>)}
        </tbody></table></div> : <div className="empty-state">{equipment.length?"Nenhum equipamento corresponde à pesquisa.":"Ainda não existem equipamentos registados."}</div>}
      </section>}
      {section === "history" && <section className="equipment-list-card admin-data-card">
        <div className="list-heading"><div><h2>Pesquisas registadas</h2><p>{history.length} consultas. Pesquisas sem sessão aparecem como visitante sem sessão.</p></div><div className="admin-filter-actions"><input className="search-input" aria-label="Pesquisar histórico" placeholder="Pesquisar SN, utilizador ou proprietário" value={filter} onChange={e=>setFilter(e.target.value)}/><button className="outline-button" onClick={()=>load("history")} disabled={loading}>Atualizar</button></div></div>
        {loading ? <div className="empty-state">A carregar histórico...</div> : filteredHistory.length ? <div className="equipment-table-wrap"><table className="equipment-table admin-table admin-history-table"><thead><tr><th>Data e hora</th><th>Quem pesquisou</th><th>SN pesquisado</th><th>Equipamento / resultado</th><th>Proprietário</th><th>Telefone</th></tr></thead><tbody>
          {filteredHistory.map(item=><tr key={item.id}><td>{item.searched_at?new Date(item.searched_at).toLocaleString("pt-PT"):"—"}</td><td><strong>{item.searcher_label||"Visitante sem sessão"}</strong><span className="table-subtitle">{item.searcher_user_id?"Conta autenticada":"Sem identificação de conta"}{item.searcher_email&&item.searcher_label!==item.searcher_email?" · "+item.searcher_email:""}</span></td><td><strong>{item.serial_searched}</strong></td><td>{item.found?<><strong>{item.equipment_name||"Equipamento registado"}</strong><span className={"admin-restriction "+(item.restriction_status==="Com restrição"||item.equipment_status==="Roubado"?"admin-restriction-red":"admin-restriction-green")}>{item.equipment_status==="Roubado"?"COM RESTRIÇÃO":item.restriction_status||"Sem restrição"}</span></>:<><strong>Sem registo</strong><span className="table-subtitle">SN não encontrado</span></>}</td><td>{item.found?item.owner_name||"Perfil por preencher":"—"}</td><td>{item.found?item.owner_phone||"—":"—"}</td></tr>)}
        </tbody></table></div> : <div className="empty-state">{history.length?"Nenhuma pesquisa corresponde ao filtro.":"Ainda não existem pesquisas registadas."}</div>}
        <p className="field-help admin-history-note">A PROTEGE não recolhe o endereço IP nesta fase. Quando alguém pesquisa sem iniciar sessão, a consulta aparece como anónima; não é possível identificar a pessoa sem exigir autenticação.</p>
      </section>}
      <p className="privacy-note">O acesso aos dados e fotografias é validado no servidor e reservado a administradores autorizados.</p>
    </section>
    <footer>PROTEGE · Administração privada</footer>
  </main>;
}
