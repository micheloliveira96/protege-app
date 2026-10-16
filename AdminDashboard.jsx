import React, { useEffect, useState } from "react";

export default function AdminDashboard({ supabase, user, onSignOut, onManageAccess }) {
  const [section, setSection] = useState("equipment");
  const [supportMessages, setSupportMessages] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [chatConversations, setChatConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatAttachment, setChatAttachment] = useState(null);
  const [chatSending, setChatSending] = useState(false);
  const [role, setRole] = useState("admin");
  const [equipment, setEquipment] = useState([]);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(action, extra = {}) {
    setLoading(true); setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-dashboard", { body: { action, ...extra } });
      if (invokeError) throw new Error(data?.error || invokeError.message || "Não foi possível carregar os dados.");
      if (data?.error) throw new Error(data.error);
      setRole(data.role || "admin");
      if (action === "equipment") setEquipment(data.equipment || []);
      if (action === "history") setHistory(data.history || []);
      if (action === "support") setSupportMessages(data.messages || []);
      if (action === "chat-list") setChatConversations(data.conversations || []);
      if (action === "chat-messages") { setChatMessages(data.messages || []); setSelectedChat(data.conversation ? {...data.conversation, user_name:data.user_name} : null); }
    } catch (e) { setError(e.message || "Não foi possível carregar os dados administrativos."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load("equipment"); }, []);
  useEffect(() => {
    if (section !== "chat") return;
    const timer = window.setInterval(() => {
      load("chat-list");
      if (selectedChat?.id) load("chat-messages", { conversation_id: selectedChat.id });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [section, selectedChat?.id]);
  async function saveSupportMessage(item, status) {
    setLoading(true); setError("");
    try {
      const {data,error:invokeError}=await supabase.functions.invoke("admin-dashboard",{body:{action:"support",operation:"update",id:item.id,status,admin_reply:replyDrafts[item.id]??item.admin_reply??""}});
      if(invokeError) throw new Error(data?.error||invokeError.message||"Não foi possível atualizar a mensagem.");
      if(data?.error) throw new Error(data.error);
      await load("support");
    } catch(e) {setError(e.message||"Não foi possível guardar a resposta.");setLoading(false);}
  }
  async function sendChatReply(event) {
    event.preventDefault();
    if (!selectedChat || (!chatDraft.trim() && !chatAttachment) || chatSending) return;
    if (chatAttachment && !["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/quicktime","video/webm","application/pdf"].includes(chatAttachment.type)) { setError("Formato não permitido. Envie uma imagem, vídeo MP4/MOV/WebM ou PDF."); return; }
    if (chatAttachment && chatAttachment.size > 25 * 1024 * 1024) { setError("O arquivo deve ter no máximo 25 MB."); return; }
    setChatSending(true); setError("");
    let attachmentPath = null;
    let messageCreated = false;
    try {
      if (chatAttachment) {
        const safeName = chatAttachment.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "arquivo";
        attachmentPath = selectedChat.user_id + "/" + selectedChat.id + "/" + crypto.randomUUID() + "-" + safeName;
        const uploaded = await supabase.storage.from("support-chat-files").upload(attachmentPath, chatAttachment, { contentType: chatAttachment.type, upsert: false });
        if (uploaded.error) throw uploaded.error;
      }
      const {data,error:invokeError}=await supabase.functions.invoke("admin-dashboard",{body:{action:"chat-send",conversation_id:selectedChat.id,message:chatDraft.trim(),attachment_path:attachmentPath,attachment_name:chatAttachment?.name||null,attachment_type:chatAttachment?.type||null,attachment_size:chatAttachment?.size||null}});
      if(invokeError) throw new Error(data?.error||invokeError.message||"Não foi possível enviar a resposta.");
      if(data?.error) throw new Error(data.error);
      messageCreated = true;
      setChatDraft(""); setChatAttachment(null);
      const fileInput = document.getElementById("admin-chat-file"); if (fileInput) fileInput.value = "";
      await load("chat-messages",{conversation_id:selectedChat.id});
      await load("chat-list");
    } catch(e) {
      if (attachmentPath && !messageCreated) {
        await supabase.storage.from("support-chat-files").remove([attachmentPath]).catch(() => {});
      }
      setError(e.message||"Não foi possível enviar a resposta.");
    }
    finally { setChatSending(false); }
  }
  const term = filter.trim().toLowerCase();
  const filteredEquipment = equipment.filter(item => [item.name,item.brand,item.model,item.category,item.serial_number,item.imei,item.status,item.restriction_status,item.owner_name,item.owner_phone].some(v => String(v || "").toLowerCase().includes(term)));
  const filteredHistory = history.filter(item => [item.searcher_label,item.searcher_email,item.serial_searched,item.searched_identifier_type,item.equipment_name,item.equipment_status,item.restriction_status,item.owner_name,item.owner_phone].some(v => String(v || "").toLowerCase().includes(term)));

  return <main className="dashboard-shell admin-shell">
    <header className="dashboard-topbar">
      <div className="dashboard-brand"><div className="brand-mark small-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Administração privada</div></div></div>
      <div className="user-actions"><span className="admin-session-label">Acesso restrito</span><span className="user-email">{user.email}</span><button className="outline-button" onClick={onSignOut}>Terminar sessão</button></div>
    </header>
    <section className="dashboard-content">
      <div className="dashboard-welcome admin-welcome"><div><p className="eyebrow">ÁREA ADMINISTRATIVA</p><h1>{section === "equipment" ? "Equipamentos cadastrados" : section === "history" ? "Histórico de pesquisas" : "Suporte ao usuário"}</h1><p className="muted-copy">{section === "equipment" ? "Consulte os equipamentos, fotos, situação e contacto do proprietário." : section === "history" ? "Consulte quem pesquisou, o número de série, o resultado e o proprietário associado." : "Mensagens enviadas pelo botão Ajuda da página inicial."}</p></div></div>
      <nav className="dashboard-tabs admin-nav" aria-label="Secções administrativas">
        <button className={"dashboard-tab " + (section === "equipment" ? "active" : "")} onClick={() => { setSection("equipment"); setFilter(""); load("equipment"); }}>Equipamentos</button>
        <button className={"dashboard-tab " + (section === "history" ? "active" : "")} onClick={() => { setSection("history"); setFilter(""); load("history"); }}>Histórico de pesquisas</button>
        <button className={"dashboard-tab " + (section === "support" ? "active" : "")} onClick={() => { setSection("support"); setFilter(""); load("support"); }}>Ajuda por formulário</button>
        <button className={"dashboard-tab " + (section === "chat" ? "active" : "")} onClick={() => { setSection("chat"); setFilter(""); load("chat-list"); }}>Chat com clientes</button>
        {role === "super_admin" && <button className="dashboard-tab" onClick={onManageAccess}>Gestão de acessos</button>}
      </nav>
      {error && <p className="dashboard-notice admin-error" role="alert">{error}</p>}
      {section === "equipment" && <section className="equipment-list-card admin-data-card">
        <div className="list-heading"><div><h2>Todos os equipamentos</h2><p>{equipment.length} registos encontrados. fotos e contactos visíveis apenas a administradores.</p></div><div className="admin-filter-actions"><input className="search-input" aria-label="Pesquisar equipamentos" placeholder="Pesquisar SN, IMEI, equipamento ou proprietário" value={filter} onChange={e=>setFilter(e.target.value)}/><button className="outline-button" onClick={()=>load("equipment")} disabled={loading}>Atualizar</button></div></div>
        {loading ? <div className="empty-state">A carregar equipamentos...</div> : filteredEquipment.length ? <div className="equipment-table-wrap"><table className="equipment-table admin-table admin-equipment-table"><thead><tr><th>Equipamento / fotos</th><th>SN / IMEI</th><th>Situação</th><th>Proprietário</th><th>Telefone</th><th>cadastrado em</th></tr></thead><tbody>
          {filteredEquipment.map(item=><tr key={item.id}><td><strong>{item.name}</strong><span className="table-subtitle">{[item.brand,item.model,item.category].filter(Boolean).join(" · ")}</span><div className="admin-inline-photos">{(item.photos||[]).map((photo,i)=><a href={photo} target="_blank" rel="noreferrer" key={photo} aria-label={"Abrir foto "+(i+1)}><img src={photo} alt={"foto "+(i+1)+" de "+item.name}/></a>)}{!(item.photos||[]).length&&<span className="table-subtitle">Sem fotos</span>}</div>{item.invoice_url&&<a className="admin-invoice-link" href={item.invoice_url} target="_blank" rel="noreferrer">Ver comprovativo de compra ↗</a>}</td><td><span className="table-subtitle">SN: {item.serial_number||"—"}</span><span className="table-subtitle">IMEI: {item.imei||"—"}</span></td><td><span className={"status-pill status-"+String(item.status||"").toLowerCase()}>{item.status||"—"}</span><span className={"admin-restriction "+(item.status==="Roubado"||item.status!=="Ativo"&&item.restriction_status==="Com restrição"?"admin-restriction-red":"admin-restriction-green")}>{item.status==="Roubado"||item.status!=="Ativo"&&item.restriction_status==="Com restrição"?"COM RESTRIÇÃO":"SEM RESTRIÇÃO"}</span></td><td><strong>{item.owner_name}</strong><span className="table-subtitle">{[item.owner_city,item.owner_country].filter(Boolean).join(" · ")}</span></td><td>{item.owner_phone||"—"}</td><td>{item.created_at?new Date(item.created_at).toLocaleString("pt-PT"):"—"}</td></tr>)}
        </tbody></table></div> : <div className="empty-state">{equipment.length?"Nenhum equipamento corresponde à pesquisa.":"Ainda não existem equipamentos cadastrados."}</div>}
      </section>}
      {section === "support" && <section className="equipment-list-card admin-data-card">
        <div className="list-heading"><div><h2>Caixa de suporte</h2><p>{supportMessages.filter(m=>m.status==="new").length} mensagens novas · {supportMessages.length} no total</p></div><button className="outline-button" onClick={()=>load("support")} disabled={loading}>Atualizar</button></div>
        {loading ? <div className="empty-state">A carregar mensagens...</div> : supportMessages.length ? <div className="support-admin-list">{supportMessages.filter(m=>!filter||[m.name,m.email,m.subject,m.message,m.status].some(v=>String(v||"").toLowerCase().includes(filter.toLowerCase()))).map(item=><article className="support-admin-message" key={item.id}>
          <div className="support-admin-heading"><div><span className={"support-status support-status-"+item.status}>{item.status==="new"?"Nova":item.status==="in_progress"?"Em análise":item.status==="answered"?"Respondida":"Fechada"}</span><h3>{item.subject}</h3><p>{item.name} · <a href={"mailto:"+item.email}>{item.email}</a></p></div><time>{new Date(item.created_at).toLocaleString("pt-PT")}</time></div>
          <p className="support-admin-body">{item.message}</p>
          {item.attachment_url&&<p><a className="admin-invoice-link" href={item.attachment_url} target="_blank" rel="noreferrer">Abrir anexo: {item.attachment_name||"arquivo"} ↗</a></p>}
          <label htmlFor={"reply-"+item.id}>Resposta / notas para contacto</label><textarea id={"reply-"+item.id} rows={3} maxLength={5000} value={replyDrafts[item.id]??item.admin_reply??""} onChange={e=>setReplyDrafts({...replyDrafts,[item.id]:e.target.value})} placeholder="Escreva uma resposta para cadastrar no pedido..."/>
          <div className="table-actions"><button className="primary-button" disabled={loading} onClick={()=>saveSupportMessage(item,"answered")}>Guardar como respondida</button><button className="outline-button" disabled={loading} onClick={()=>saveSupportMessage(item,"in_progress")}>Em análise</button><button className="outline-button" disabled={loading} onClick={()=>saveSupportMessage(item,"closed")}>Fechar pedido</button></div>
        </article>)}</div> : <div className="empty-state">Ainda não foram recebidas mensagens de suporte.</div>}
        <p className="field-help admin-history-note">As respostas ficam cadastradas nesta caixa. Nesta versão, o sistema não envia emails automaticamente; para responder por email, utilize o endereço do remetente e registe aqui o estado do pedido.</p>
      </section>}
      {section === "chat" && <section className="equipment-list-card admin-data-card admin-chat-card">
        <div className="list-heading"><div><h2>Chat de suporte</h2><p>{chatConversations.length} conversas de clientes · As mensagens são atualizadas ao abrir cada conversa.</p></div><button className="outline-button" onClick={()=>load("chat-list")} disabled={loading}>Atualizar</button></div>
        <div className="admin-chat-layout">
          <aside className="admin-chat-conversations" aria-label="Conversas de suporte">
            {chatConversations.length ? chatConversations.map(item=><button type="button" key={item.id} className={"admin-chat-conversation "+(selectedChat?.id===item.id?"selected":"")} onClick={()=>load("chat-messages",{conversation_id:item.id})}>
              <span className="admin-chat-user-avatar"> {item.user_name?.[0]?.toUpperCase()||"U"} </span><span className="admin-chat-conversation-copy"><strong>{item.user_name}</strong><small>{item.last_message?.message||"Ainda sem mensagens"}</small><small>{item.last_message?.created_at?new Date(item.last_message.created_at).toLocaleString("pt-PT"):"Conversa criada"}</small></span><span className={"admin-chat-status "+(item.status==="closed"?"closed":"open")}>{item.status==="waiting_admin"?"Nova":item.status==="waiting_user"?"Respondida":item.status==="closed"?"Fechada":"Aberta"}</span>
            </button>) : <div className="empty-state">Ainda não existem conversas de suporte.</div>}
          </aside>
          <div className="admin-chat-thread">
            {!selectedChat ? <div className="empty-state">Selecione uma conversa para ler e responder às mensagens.</div> : <>
              <div className="admin-chat-thread-heading"><div><h3>{selectedChat.user_name||"Usuário PROTEGE"}</h3><p>Conversa privada · Criada em {new Date(selectedChat.created_at).toLocaleDateString("pt-PT")}</p></div><span className={"admin-chat-status "+(selectedChat.status==="closed"?"closed":"open")}>{selectedChat.status==="waiting_admin"?"A aguardar resposta":selectedChat.status==="waiting_user"?"A aguardar cliente":selectedChat.status==="closed"?"Fechada":"Aberta"}</span></div>
              <div className="admin-chat-thread-messages">{chatMessages.length ? chatMessages.map(item=><article key={item.id} className={"support-chat-message "+(item.sender_role==="admin"?"mine":"theirs")}><span className="support-chat-sender">{item.sender_role==="admin"?"Equipa PROTEGE":selectedChat.user_name||"Cliente"}</span>{item.message && <p>{item.message}</p>}{item.attachment_url && <a className="chat-attachment-link" href={item.attachment_url} target="_blank" rel="noreferrer">{item.attachment_type?.startsWith("image/") ? <img className="chat-attachment-image" src={item.attachment_url} alt={item.attachment_name||"Imagem anexada"}/> : item.attachment_type?.startsWith("video/") ? <video className="chat-attachment-video" src={item.attachment_url} controls preload="metadata"/> : <span className="chat-attachment-file">📎 {item.attachment_name||"Abrir arquivo"}</span>}</a>}{item.attachment_path && !item.attachment_url && <span className="chat-attachment-file">📎 {item.attachment_name||"Anexo"}</span>}<time>{new Date(item.created_at).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"})}</time></article>) : <div className="empty-state">Esta conversa ainda não tem mensagens.</div>}</div>
              <form className="support-chat-composer admin-chat-composer" onSubmit={sendChatReply}><div className="support-chat-inputs"><textarea value={chatDraft} onChange={e=>setChatDraft(e.target.value)} rows={2} maxLength={5000} placeholder="Escreva a resposta ao cliente..." aria-label="Resposta ao cliente"/><div className="support-chat-file-row"><label className="chat-file-button" htmlFor="admin-chat-file">＋ Anexar arquivo</label><input id="admin-chat-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf" onChange={e=>setChatAttachment(e.target.files?.[0]||null)} hidden/><span className="field-help">Imagem, vídeo ou PDF · Máx. 25 MB</span>{chatAttachment && <span className="chat-file-selected">{chatAttachment.name} <button type="button" onClick={()=>{setChatAttachment(null);const el=document.getElementById("admin-chat-file");if(el)el.value="";}}>×</button></span>}</div></div><button className="primary-button" type="submit" disabled={chatSending||(!chatDraft.trim()&&!chatAttachment)}>{chatSending?"A enviar...":"Responder"} <span aria-hidden="true">➤</span></button></form>
            </>}
          </div>
        </div>
        <p className="field-help admin-history-note">As respostas enviadas aqui aparecem diretamente na área Suporte do cliente, sem emails nem formulários adicionais.</p>
      </section>}
      {section === "history" && <section className="equipment-list-card admin-data-card">
        <div className="list-heading"><div><h2>Pesquisas cadastradas</h2><p>{history.length} consultas. Pesquisas sem sessão aparecem como visitante sem sessão.</p></div><div className="admin-filter-actions"><input className="search-input" aria-label="Pesquisar histórico" placeholder="Pesquisar SN, IMEI, usuário ou proprietário" value={filter} onChange={e=>setFilter(e.target.value)}/><button className="outline-button" onClick={()=>load("history")} disabled={loading}>Atualizar</button></div></div>
        {loading ? <div className="empty-state">A carregar histórico...</div> : filteredHistory.length ? <div className="equipment-table-wrap"><table className="equipment-table admin-table admin-history-table"><thead><tr><th>Data e hora</th><th>Quem pesquisou</th><th>SN / IMEI pesquisado</th><th>Equipamento / resultado</th><th>Proprietário</th><th>Telefone</th></tr></thead><tbody>
          {filteredHistory.map(item=><tr key={item.id}><td>{item.searched_at?new Date(item.searched_at).toLocaleString("pt-PT"):"—"}</td><td><strong>{item.searcher_label||"Visitante sem sessão"}</strong><span className="table-subtitle">{item.searcher_user_id?"Conta autenticada":"Sem identificação de conta"}{item.searcher_email&&item.searcher_label!==item.searcher_email?" · "+item.searcher_email:""}</span></td><td><strong>{item.searched_identifier_type || "SN / IMEI"}: {item.serial_searched}</strong></td><td>{item.found?<><strong>{item.equipment_name||"Equipamento cadastrado"}</strong><span className={"admin-restriction "+(item.restriction_status==="Com restrição"||item.equipment_status==="Roubado"?"admin-restriction-red":"admin-restriction-green")}>{item.equipment_status==="Roubado"?"COM RESTRIÇÃO":item.restriction_status||"Sem restrição"}</span></>:<><strong>Sem cadastro</strong><span className="table-subtitle">SN não encontrado</span></>}</td><td>{item.found?item.owner_name||"Perfil por preencher":"—"}</td><td>{item.found?item.owner_phone||"—":"—"}</td></tr>)}
        </tbody></table></div> : <div className="empty-state">{history.length?"Nenhuma pesquisa corresponde ao filtro.":"Ainda não existem pesquisas cadastradas."}</div>}
        <p className="field-help admin-history-note">A PROTEGE não recolhe o endereço IP nesta fase. Quando alguém pesquisa sem iniciar sessão, a consulta aparece como anônima; não é possível identificar a pessoa sem exigir autenticação.</p>
      </section>}
      <p className="privacy-note">O acesso aos dados e fotos é validado no servidor e reservado a administradores autorizados.</p>
    </section>
    <footer>PROTEGE · Administração privada</footer>
  </main>;
}
