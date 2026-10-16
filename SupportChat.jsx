import React, { useCallback, useEffect, useState } from "react";

export default function SupportChat({ supabase, user }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async (conversationId, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data, error: queryError } = await supabase.from("support_chat_messages")
        .select("id,conversation_id,sender_id,sender_role,message,created_at")
        .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(500);
      if (queryError) throw queryError;
      setMessages(data || []);
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
    if (!message || !conversation || sending) return;
    if (message.length > 5000) { setError("A mensagem não pode ultrapassar 5.000 caracteres."); return; }
    setSending(true); setError("");
    try {
      const inserted = await supabase.from("support_chat_messages").insert({
        conversation_id: conversation.id, sender_id: user.id, sender_role: "user", message
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      await supabase.from("support_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "waiting_admin" }).eq("id", conversation.id);
      setDraft("");
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
        <p>{item.message}</p><time>{new Date(item.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}</time>
      </article>)}
    </div>
    <form className="support-chat-composer" onSubmit={sendMessage}>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escreva a sua mensagem..." rows={2} maxLength={5000} aria-label="Mensagem para o suporte" disabled={!conversation || sending}/>
      <button className="primary-button" type="submit" disabled={!conversation || !draft.trim() || sending}>{sending ? "A enviar..." : "Enviar"} <span aria-hidden="true">➤</span></button>
    </form>
    <p className="field-help support-chat-footnote">Não precisa de indicar nome ou email. A PROTEGE identifica a sua conta automaticamente.</p>
  </section>;
}
