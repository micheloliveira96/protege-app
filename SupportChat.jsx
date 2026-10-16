import React, { useCallback, useEffect, useState } from "react";

export default function SupportChat({ supabase, user }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async (conversationId, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data, error: queryError } = await supabase.from("support_chat_messages")
        .select("id,conversation_id,sender_id,sender_role,message,attachment_path,attachment_name,attachment_type,attachment_size,created_at")
        .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(500);
      if (queryError) throw queryError;
      const enriched = await Promise.all((data || []).map(async item => {
        if (!item.attachment_path) return item;
        const { data: signed } = await supabase.storage.from("support-chat-files").createSignedUrl(item.attachment_path, 3600);
        return { ...item, attachment_url: signed?.signedUrl || null };
      }));
      setMessages(enriched);
      setError("");
    } catch {
      if (!quiet) setError("Não foi possível carregar a conversa. Tente atualizar a página.");
    } finally { if (!quiet) setLoading(false); }
  }, [supabase]);

  const ensureConversation = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let { data, error: queryError } = await supabase.from("support_conversations")
        .select("id,user_id,status,created_at,last_message_at").eq("user_id", user.id).maybeSingle();
      if (queryError) throw queryError;
      if (!data) {
        const created = await supabase.from("support_conversations").insert({ user_id: user.id })
          .select("id,user_id,status,created_at,last_message_at").single();
        if (created.error) {
          if (created.error.code === "23505") {
            const retry = await supabase.from("support_conversations").select("id,user_id,status,created_at,last_message_at").eq("user_id", user.id).single();
            if (retry.error) throw retry.error;
            data = retry.data;
          } else throw created.error;
        } else data = created.data;
      }
      setConversation(data);
      await loadMessages(data.id);
    } catch {
      setError("Não foi possível abrir o suporte. Verifique a ligação e tente novamente.");
      setLoading(false);
    }
  }, [supabase, user.id, loadMessages]);

  useEffect(() => { ensureConversation(); }, [ensureConversation]);

  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase.channel("support-chat-" + conversation.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_chat_messages", filter: "conversation_id=eq." + conversation.id }, () => loadMessages(conversation.id, true))
      .subscribe();
    const interval = window.setInterval(() => loadMessages(conversation.id, true), 10000);
    return () => { window.clearInterval(interval); supabase.removeChannel(channel); };
  }, [supabase, conversation?.id, loadMessages]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !attachment) || !conversation || sending) return;
    if (message.length > 5000) { setError("A mensagem não pode ultrapassar 5.000 caracteres."); return; }
    if (attachment && !["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/quicktime","video/webm","application/pdf"].includes(attachment.type)) { setError("Formato não permitido. Envie uma imagem, vídeo MP4/MOV/WebM ou PDF."); return; }
    if (attachment && attachment.size > 25 * 1024 * 1024) { setError("O arquivo deve ter no máximo 25 MB."); return; }
    setSending(true); setError("");
    let attachmentPath = null;
    try {
      if (attachment) {
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "arquivo";
        attachmentPath = user.id + "/" + conversation.id + "/" + crypto.randomUUID() + "-" + safeName;
        const uploaded = await supabase.storage.from("support-chat-files").upload(attachmentPath, attachment, { contentType: attachment.type, upsert: false });
        if (uploaded.error) throw uploaded.error;
      }
      const inserted = await supabase.from("support_chat_messages").insert({
        conversation_id: conversation.id, sender_id: user.id, sender_role: "user", message,
        attachment_path: attachmentPath, attachment_name: attachment?.name || null,
        attachment_type: attachment?.type || null, attachment_size: attachment?.size || null
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      await supabase.from("support_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "waiting_admin" }).eq("id", conversation.id);
      setDraft(""); setAttachment(null);
      const fileInput = document.getElementById("customer-chat-file"); if (fileInput) fileInput.value = "";
      await loadMessages(conversation.id, true);
    } catch {
      setError("Não foi possível enviar a mensagem. Tente novamente.");
    } finally { setSending(false); }
  }

  return <section className="equipment-list-card support-chat-card">
    <div className="support-chat-header">
      <div className="support-chat-avatar" aria-hidden="true">P</div>
      <div className="support-chat-heading"><h2>Suporte PROTEGE</h2><p>Conversa privada com a equipa de suporte</p></div>
      <span className={"support-chat-state " + (conversation?.status === "closed" ? "closed" : "open")}>{conversation?.status === "closed" ? "Pedido fechado" : "Canal ativo"}</span>
    </div>
    <div className="support-chat-privacy"><span aria-hidden="true">🔒</span> Esta conversa está associada à sua conta. Só você e os administradores autorizados podem consultá-la.</div>
    {error && <p className="dashboard-notice admin-error" role="alert">{error}</p>}
    <div className="support-chat-messages" aria-live="polite">
      {loading ? <div className="empty-state">A abrir a conversa...</div> : messages.length === 0 ? <div className="support-chat-empty"><span>✦</span><h3>Como podemos ajudar?</h3><p>Escreva a sua dúvida abaixo. A equipa PROTEGE responderá nesta conversa.</p></div> : messages.map(item => <article key={item.id} className={"support-chat-message " + (item.sender_role === "user" ? "mine" : "theirs")}>
        {item.sender_role !== "user" && <span className="support-chat-sender">Equipa PROTEGE</span>}
        {item.message && <p>{item.message}</p>}{item.attachment_url && <a className="chat-attachment-link" href={item.attachment_url} target="_blank" rel="noreferrer">{item.attachment_type?.startsWith("image/") ? <img className="chat-attachment-image" src={item.attachment_url} alt={item.attachment_name || "Imagem anexada"}/> : item.attachment_type?.startsWith("video/") ? <video className="chat-attachment-video" src={item.attachment_url} controls preload="metadata"/> : <span className="chat-attachment-file">📎 {item.attachment_name || "Abrir arquivo"}</span>}</a>}{item.attachment_path && !item.attachment_url && <span className="chat-attachment-file">📎 {item.attachment_name || "Anexo"}</span>}<time>{new Date(item.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}</time>
      </article>)}
    </div>
    <form className="support-chat-composer" onSubmit={sendMessage}>
      <div className="support-chat-inputs"><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escreva a sua mensagem..." rows={2} maxLength={5000} aria-label="Mensagem para o suporte" disabled={!conversation || sending}/><div className="support-chat-file-row"><label className="chat-file-button" htmlFor="customer-chat-file">＋ Anexar arquivo</label><input id="customer-chat-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf" onChange={e => setAttachment(e.target.files?.[0] || null)} disabled={sending} hidden/><span className="field-help">Imagem, vídeo ou PDF · Máx. 25 MB</span>{attachment && <span className="chat-file-selected">{attachment.name} <button type="button" onClick={() => {setAttachment(null); const el=document.getElementById("customer-chat-file"); if(el) el.value="";}}>×</button></span>}</div></div>
      <button className="primary-button" type="submit" disabled={!conversation || (!draft.trim() && !attachment) || sending}>{sending ? "A enviar..." : "Enviar"} <span aria-hidden="true">➤</span></button>
    </form>
    <p className="field-help support-chat-footnote">Não precisa de indicar nome ou e-mail. A PROTEGE identifica a sua conta automaticamente.</p>
  </section>;
}
