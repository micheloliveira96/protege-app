import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";
import AdminDashboard from "./AdminDashboard.jsx";
import SupportChat from "./SupportChat.jsx";

const emptyEquipment = {
  name: "", category: "Eletrônicos", brand: "", model: "",
  serial_number: "", imei: "", description: "", status: "Ativo"
};
const categories = ["Eletrônicos", "Informática", "celular", "foto", "Veículo", "Ferramenta", "Casa", "Outro"];
const statuses = ["Ativo", "Perdido", "Roubado", "Vendido"];
const bucketName = "equipment-evidence";
const documentBucketName = "equipment-documents";

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
        reject(new Error("Não foi possível preparar a foto."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) return reject(new Error("Não foi possível comprimir a foto."));
        resolve(blob);
      }, "image/jpeg", 0.78);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Um dos arquivos selecionados não é uma imagem válida."));
    };
    image.src = objectUrl;
  });
}


function AdminAccessPanel({ supabase, user, onSignOut, onBack }) {
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [username, setUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [confirmCreatePassword, setConfirmCreatePassword] = useState("");
  const [ownCurrentPassword, setOwnCurrentPassword] = useState("");
  const [ownPassword, setOwnPassword] = useState("");
  const [confirmOwnPassword, setConfirmOwnPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showOwnPasswords, setShowOwnPasswords] = useState(false);
  const [resetAdmin, setResetAdmin] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showResetPasswords, setShowResetPasswords] = useState(false);
  const [newUsername, setNewUsername] = useState(user.user_metadata?.username || "admin");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function callAdmin(action, extra = {}) {
    const { data, error } = await supabase.functions.invoke("manage-admins", { body: { action, ...extra } });
    if (error) throw new Error(data?.error || error.message || "Não foi possível concluir a operação.");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function loadAdmins() {
    setLoadingAdmins(true); setError("");
    try { const data = await callAdmin("list"); setAdmins(data.admins || []); }
    catch (e) { setError(e.message || "Não foi possível carregar os administradores."); }
    finally { setLoadingAdmins(false); }
  }
  useEffect(() => { loadAdmins(); }, []);

  async function createAdmin(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (createPassword.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres.");
      if (createPassword !== confirmCreatePassword) throw new Error("A confirmação da senha não coincide.");
      await callAdmin("create", { username: username.trim(), password: createPassword });
      setUsername(""); setCreatePassword(""); setConfirmCreatePassword(""); setShowCreatePassword(false);
      setMessage("Conta administrativa criada com sucesso.");
      await loadAdmins();
    } catch (e) { setError(e.message || "Não foi possível criar a conta."); }
    finally { setBusy(false); }
  }
  async function updateAdminAccount(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (ownPassword || ownCurrentPassword || confirmOwnPassword) {
        if (!ownCurrentPassword) throw new Error("Digite a senha antiga.");
        if (ownPassword.length < 12) throw new Error("A nova senha deve ter pelo menos 12 caracteres.");
        if (ownPassword !== confirmOwnPassword) throw new Error("A confirmação da nova senha não coincide.");
        if (ownPassword === ownCurrentPassword) throw new Error("A nova senha deve ser diferente da antiga.");
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: ownCurrentPassword });
        if (verifyError) throw new Error("A senha antiga está incorreta.");
        const { error: updateError } = await supabase.auth.updateUser({ password: ownPassword });
        if (updateError) throw updateError;
      }
      if (newUsername.trim() && newUsername.trim().toLowerCase() !== (user.user_metadata?.username || "")) {
        await callAdmin("change-username", { username: newUsername.trim() });
      }
      setOwnCurrentPassword(""); setOwnPassword(""); setConfirmOwnPassword(""); setShowOwnPasswords(false);
      setMessage("Dados da conta atualizados. Se alterou o nome de usuário, use-o na próxima sessão.");
      await loadAdmins();
    } catch (e) { setError(e.message || "Não foi possível atualizar a conta."); }
    finally { setBusy(false); }
  }
  async function changeAdminPassword(event) {
    event.preventDefault();
    if (!resetAdmin) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (resetPassword.length < 12) throw new Error("A nova senha deve ter pelo menos 12 caracteres.");
      if (resetPassword !== confirmResetPassword) throw new Error("A confirmação da nova senha não coincide.");
      await callAdmin("change-password", { user_id: resetAdmin.user_id, password: resetPassword });
      setMessage("Senha de " + resetAdmin.username + " alterada com sucesso.");
      setResetAdmin(null); setResetPassword(""); setConfirmResetPassword(""); setShowResetPasswords(false);
    } catch (e) { setError(e.message || "Não foi possível alterar a senha."); }
    finally { setBusy(false); }
  }
  async function removeAdmin(item) {
    if (!window.confirm("Remover o acesso administrativo de " + item.username + "? Esta ação elimina a conta de autenticação associada.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await callAdmin("delete", { user_id: item.user_id }); setMessage("Conta administrativa removida."); await loadAdmins(); }
    catch (e) { setError(e.message || "Não foi possível remover a conta."); }
    finally { setBusy(false); }
  }
  async function handOverSuperAdmin(item) {
    if (!window.confirm("Transferir o superadministrador para «" + item.username + "» e retirar imediatamente o acesso administrativo desta conta? Terá de iniciar sessão com a nova conta.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await callAdmin("transfer-super-admin", { user_id: item.user_id });
      await supabase.auth.signOut();
      window.location.href = "/admin";
    } catch (e) { setError(e.message || "Não foi possível transferir a administração."); setBusy(false); }
  }

  return (
    <main className="dashboard-shell admin-shell">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <div className="brand-mark small-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div>
          <div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Administração privada</div></div>
        </div>
        <div className="user-actions"><span className="admin-session-label">Acesso restrito</span><span className="user-email">{user.email}</span><button className="outline-button" onClick={onBack}>Voltar ao painel</button><button className="outline-button" onClick={onSignOut}>Terminar sessão</button></div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-welcome admin-welcome"><div><p className="eyebrow">SUPERADMINISTRAÇÃO</p><h1>Gestão de acessos</h1><p className="muted-copy">Crie e remova contas administrativas e proteja as credenciais de acesso.</p></div></div>
        {error && <p className="dashboard-notice admin-error" role="alert">{error}</p>}
        {message && <p className="dashboard-notice" role="status">{message}</p>}
        <section className="equipment-form-card">
          <div className="form-card-heading"><div><h2>A minha conta administrativa</h2><p>Altere o nome de usuário e/ou a senha.</p></div></div>
          <form className="equipment-form" onSubmit={updateAdminAccount}>
            <div className="field-grid">
              <div><label htmlFor="admin-own-username">Nome de usuário</label><input id="admin-own-username" value={newUsername} onChange={e=>setNewUsername(e.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required/></div>
            </div>
            <div className="password-section"><h3>Alterar senha</h3><p className="field-help">Para sua segurança, confirme a senha antiga antes de definir uma nova.</p>
              <div className="field-grid">
                <div className="password-field"><label htmlFor="admin-own-current-password">Senha antiga</label><div className="password-input-wrap"><input id="admin-own-current-password" type={showOwnPasswords ? "text" : "password"} autoComplete="current-password" value={ownCurrentPassword} onChange={e=>setOwnCurrentPassword(e.target.value)} placeholder="Senha atual"/><button type="button" className="password-visibility" onClick={()=>setShowOwnPasswords(v=>!v)} aria-label={showOwnPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showOwnPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
                <div className="password-field"><label htmlFor="admin-own-password">Nova senha</label><div className="password-input-wrap"><input id="admin-own-password" type={showOwnPasswords ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo de 12 caracteres" value={ownPassword} onChange={e=>setOwnPassword(e.target.value)} minLength={12}/><button type="button" className="password-visibility" onClick={()=>setShowOwnPasswords(v=>!v)} aria-label={showOwnPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showOwnPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
                <div className="password-field"><label htmlFor="admin-own-confirm-password">Confirmar nova senha</label><div className="password-input-wrap"><input id="admin-own-confirm-password" type={showOwnPasswords ? "text" : "password"} autoComplete="new-password" value={confirmOwnPassword} onChange={e=>setConfirmOwnPassword(e.target.value)} minLength={12}/><button type="button" className="password-visibility" onClick={()=>setShowOwnPasswords(v=>!v)} aria-label={showOwnPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showOwnPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
              </div>
            </div>
            <p className="field-help">A senha só será alterada se preencher os três campos. A nova senha deve ter pelo menos 12 caracteres.</p>
            <div className="form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "A guardar..." : "Guardar alterações"}</button></div>
          </form>
        </section>
        <section className="equipment-form-card">
          <div className="form-card-heading"><div><h2>Criar administrador</h2><p>Esta área não permite criar contas públicas; apenas contas administrativas.</p></div></div>
          <form className="equipment-form" onSubmit={createAdmin}>
            <div className="field-grid">
              <div><label htmlFor="new-admin-username">Nome de usuário</label><input id="new-admin-username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ex.: operador01" minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required/></div>
              <div className="password-field"><label htmlFor="new-admin-password">Senha inicial</label><div className="password-input-wrap"><input id="new-admin-password" type={showCreatePassword ? "text" : "password"} autoComplete="new-password" value={createPassword} onChange={e=>setCreatePassword(e.target.value)} placeholder="Mínimo de 12 caracteres" minLength={12} required/><button type="button" className="password-visibility" onClick={()=>setShowCreatePassword(v=>!v)} aria-label={showCreatePassword ? "Ocultar senha" : "Mostrar senha"}>{showCreatePassword ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
              <div className="password-field"><label htmlFor="confirm-new-admin-password">Confirmar senha</label><div className="password-input-wrap"><input id="confirm-new-admin-password" type={showCreatePassword ? "text" : "password"} autoComplete="new-password" value={confirmCreatePassword} onChange={e=>setConfirmCreatePassword(e.target.value)} placeholder="Repita a senha" minLength={12} required/><button type="button" className="password-visibility" onClick={()=>setShowCreatePassword(v=>!v)} aria-label={showCreatePassword ? "Ocultar senha" : "Mostrar senha"}>{showCreatePassword ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
            </div>
            <p className="field-help">Use uma senha única com pelo menos 12 caracteres. Entregue as credenciais diretamente e em segurança.</p>
            <div className="form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "A criar..." : "Criar conta administrativa"}</button></div>
          </form>
        </section>
        <section className="equipment-list-card admin-list-card">
          <div className="list-heading"><div><h2>Contas administrativas</h2><p>Somente o superadministrador pode gerir estas contas.</p></div><button className="outline-button" onClick={loadAdmins} disabled={loadingAdmins}>Atualizar</button></div>
          {resetAdmin && <form className="equipment-form admin-reset-form" onSubmit={changeAdminPassword}>
            <div className="form-card-heading"><div><h3>Alterar senha de {resetAdmin.username}</h3><p>Defina uma nova senha para esta conta administrativa.</p></div><button className="close-button" type="button" onClick={()=>{setResetAdmin(null);setResetPassword("");setConfirmResetPassword("");setShowResetPasswords(false);}} aria-label="Cancelar">×</button></div>
            <div className="field-grid">
              <div className="password-field"><label htmlFor="reset-admin-password">Nova senha</label><div className="password-input-wrap"><input id="reset-admin-password" type={showResetPasswords ? "text" : "password"} autoComplete="new-password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} minLength={12} required/><button type="button" className="password-visibility" onClick={()=>setShowResetPasswords(v=>!v)} aria-label={showResetPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showResetPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
              <div className="password-field"><label htmlFor="confirm-reset-admin-password">Confirmar nova senha</label><div className="password-input-wrap"><input id="confirm-reset-admin-password" type={showResetPasswords ? "text" : "password"} autoComplete="new-password" value={confirmResetPassword} onChange={e=>setConfirmResetPassword(e.target.value)} minLength={12} required/><button type="button" className="password-visibility" onClick={()=>setShowResetPasswords(v=>!v)} aria-label={showResetPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showResetPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
            </div><div className="form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "A guardar..." : "Guardar nova senha"}</button></div>
          </form>}
          {loadingAdmins ? <div className="empty-state">A carregar as contas...</div> : admins.length === 0 ? <div className="empty-state">Não existem contas administrativas.</div> :
            <div className="equipment-table-wrap"><table className="equipment-table admin-table"><thead><tr><th>Usuário</th><th>Tipo de acesso</th><th>Conta de autenticação</th><th>Ações</th></tr></thead><tbody>
              {admins.map(item=><tr key={item.user_id}><td><strong>{item.username || "Sem nome"}</strong></td><td>{item.role === "super_admin" ? "Superadministrador" : "Administrador"}</td><td>{item.email}</td><td><div className="table-actions">
                {item.role !== "super_admin" && <button className="text-button" disabled={busy} onClick={()=>{setResetAdmin(item);setResetPassword("");setConfirmResetPassword("");setShowResetPasswords(false);setError("");setMessage("");}}>Alterar senha</button>}
                {item.role !== "super_admin" && <button className="delete-button" disabled={busy} onClick={()=>removeAdmin(item)}>Remover</button>}
                {item.role !== "super_admin" && <button className="text-button" disabled={busy} onClick={()=>handOverSuperAdmin(item)}>Transferir superadmin</button>}
              </div></td></tr>)}
            </tbody></table></div>}
        </section>
        <p className="privacy-note">A administração é validada no servidor. O endereço /admin não substitui a autenticação nem as permissões.</p>
      </section>
      <footer>PROTEGE · Administração privada</footer>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState("login");
  const [landingMode, setLandingMode] = useState(true);
  const [helpPage, setHelpPage] = useState(false);
  const [supportPage, setSupportPage] = useState(false);
  const [supportForm, setSupportForm] = useState({name:"",email:"",subject:"",message:""});
  const [supportFile, setSupportFile] = useState(null);
  const [supportSending, setSupportSending] = useState(false);
  const [supportNotice, setSupportNotice] = useState("");
  const [supportError, setSupportError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [adminAccessMode, setAdminAccessMode] = useState(false);
  const [equipment, setEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [dashboardNotice, setDashboardNotice] = useState("");
  const [activeTab, setActiveTab] = useState("mine");
  const [lookupSerial, setLookupSerial] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [showPublicLookup, setShowPublicLookup] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [purchaseProofFile, setPurchaseProofFile] = useState(null);
  const [existingPurchaseProof, setExistingPurchaseProof] = useState(null);
  const [ownershipConfirmation, setOwnershipConfirmation] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [currentUserPassword, setCurrentUserPassword] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [confirmUserPassword, setConfirmUserPassword] = useState("");
  const [showUserPasswords, setShowUserPasswords] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const [removedPhotos, setRemovedPhotos] = useState([]);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", date_of_birth: "", country: "", city: "", phone: "" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [isAdminRoute] = useState(() => window.location.pathname.replace(/\/+$/, "") === "/admin");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadEquipment();
      loadProfile();
    } else {
      setEquipment([]);
      setProfile(null);
      setProfileUserId(null);
      setProfileLoading(false);
      setShowAccount(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function verifyAdmin() {
      if (!session?.user?.id || !supabase) {
        setIsAdmin(false);
        setAdminChecking(false);
        return;
      }
      setAdminChecking(true);
      const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!cancelled) {
        setIsAdmin(!error && Boolean(data));
        setAdminChecking(false);
      }
    }
    verifyAdmin();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function loadProfile() {
    if (!supabase || !session?.user) return;
    setProfileLoading(true);
    setProfileNotice("");
    const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", session.user.id).maybeSingle();
    if (error) {
      setProfileNotice("Não foi possível carregar os dados da conta: " + error.message);
      setProfile(null);
      setShowAccount(true);
    } else {
      setProfile(data || null);
      setProfileForm({
        first_name: data?.first_name || "",
        last_name: data?.last_name || "",
        date_of_birth: data?.date_of_birth || "",
        country: data?.country || "",
        city: data?.city || "",
        phone: data?.phone || ""
      });
      if (data?.profile_photo_path) {
        const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(data.profile_photo_path, 3600);
        setProfilePhotoUrl(signed?.signedUrl || "");
      } else {
        setProfilePhotoUrl("");
      }
      if (!data || !data.first_name?.trim() || !data.last_name?.trim() || !data.phone?.trim() || !data.country?.trim()) {
        setShowAccount(true);
      }
    }
    setProfileUserId(session.user.id);
    setProfileLoading(false);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    const firstName = profileForm.first_name.trim();
    const lastName = profileForm.last_name.trim();
    const phone = profileForm.phone.trim();
    const country = profileForm.country.trim();
    if (!firstName || !lastName || !phone || !country) {
      setProfileNotice("Preencha os campos obrigatórios: nome, sobrenome, celular e país.");
      return;
    }
    const changingPassword = Boolean(currentUserPassword || newUserPassword || confirmUserPassword);
    if (changingPassword) {
      if (!currentUserPassword) { setProfileNotice("Digite a senha antiga para a poder alterar."); return; }
      if (newUserPassword.length < 12) { setProfileNotice("A nova senha deve ter pelo menos 12 caracteres."); return; }
      if (newUserPassword !== confirmUserPassword) { setProfileNotice("A confirmação da nova senha não coincide."); return; }
      if (newUserPassword === currentUserPassword) { setProfileNotice("A nova senha deve ser diferente da antiga."); return; }
    }
    setProfileSaving(true);
    setProfileNotice("");
    try {
      if (changingPassword) {
        const { error: verifyPasswordError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentUserPassword });
        if (verifyPasswordError) throw new Error("A senha antiga está incorreta.");
      }
      const oldProfilePhotoPath = profile?.profile_photo_path || null;
      let photoPath = removeProfilePhoto ? null : oldProfilePhotoPath;
      if (profilePhoto) {
        if (!profilePhoto.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem válido.");
        const blob = await compressPhoto(profilePhoto);
        if (blob.size > 2 * 1024 * 1024) throw new Error("A foto de perfil deve ter no máximo 2 MB.");
        const newPath = session.user.id + "/" + crypto.randomUUID() + ".jpg";
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(newPath, blob, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
        photoPath = newPath;
      }
      const payload = {
        user_id: session.user.id,
        first_name: firstName,
        last_name: lastName,
        phone,
        country,
        date_of_birth: profileForm.date_of_birth || null,
        city: profileForm.city.trim() || null,
        profile_photo_path: photoPath,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      if (changingPassword) {
        const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: newUserPassword });
        if (passwordUpdateError) throw passwordUpdateError;
        setCurrentUserPassword(""); setNewUserPassword(""); setConfirmUserPassword(""); setShowUserPasswords(false);
      }
      if (oldProfilePhotoPath && oldProfilePhotoPath !== photoPath) {
        await supabase.storage.from("profile-photos").remove([oldProfilePhotoPath]);
      }
      setProfilePhoto(null);
      setRemoveProfilePhoto(false);
      await loadProfile();
      setShowAccount(false);
      setProfileNotice("");
      setDashboardNotice("Dados da conta guardados com sucesso.");
    } catch (error) {
      setProfileNotice("Não foi possível guardar os dados: " + (error?.message || "erro desconhecido"));
    } finally {
      setProfileSaving(false);
    }
  }

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
    register: ["Criar conta", "cadastre-se para começar a proteger os seus equipamentos."],
    reset: ["Recuperar senha", "Indique o seu email para recuperar o acesso."]
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
        const loginEmail = isAdminRoute && !email.includes("@") ? email.trim().toLowerCase() + "@admin.protege.local" : email.trim();
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
      } else if (screen === "register") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setPassword("");
        if (data.session) setNotice("Conta criada com sucesso. Já pode começar a cadastrar os seus equipamentos.");
        else {
          setScreen("login");
          setNotice("Conta criada. Verifique o seu email e clique no link de confirmação antes de entrar.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setNotice("Se existir uma conta associada a esse email, receberá instruções para recuperar a senha.");
      }
    } catch (error) {
      const message = error?.message || "Ocorreu um erro. Tente novamente.";
      setNotice(message.toLowerCase().includes("invalid login credentials") ? "email ou senha incorretos." : message);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setNotice("A ligação ao Supabase não está configurada.");
      return;
    }
    setNotice("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { access_type: "offline", prompt: "select_account" }
        }
      });
      if (error) throw error;
    } catch (error) {
      setNotice(error?.message || "Não foi possível iniciar sessão com Google.");
      setLoading(false);
    }
  }

  function changeScreen(next) {
    setLandingMode(false);
    setScreen(next);
    setPassword("");
    setNotice("");
  }

  function startNewEquipment() {
    setEditingId(null);
    setEquipmentForm(emptyEquipment);
    setRemovedPhotos([]);
    setSelectedPhotos([]);
    setExistingPhotos([]);
    setPurchaseProofFile(null);
    setExistingPurchaseProof(null);
    setOwnershipConfirmation(false);
    setDashboardNotice("");
    setShowForm(true);
  }

  async function startEdit(item) {
    setEditingId(item.id);
    setRemovedPhotos([]);
    setEquipmentForm({
      name: item.name || "", category: item.category || "Outro", brand: item.brand || "",
      model: item.model || "", serial_number: item.serial_number || "", imei: item.imei || "",
      description: item.description || "", status: item.status || "Ativo"
    });
    setSelectedPhotos([]);
    setPurchaseProofFile(null);
    setExistingPurchaseProof(item.invoice_path ? { path: item.invoice_path, name: item.invoice_file_name || "Comprovativo de compra" } : null);
    setOwnershipConfirmation(false);
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
      setDashboardNotice("Pode guardar no máximo 4 fotos por equipamento.");
    }
    const valid = files.slice(0, available).filter(file => file.type.startsWith("image/"));
    setSelectedPhotos(current => [...current, ...valid]);
    event.target.value = "";
  }

  function removeExistingPhoto(path) {
    setExistingPhotos(current => current.filter(photo => photo.path !== path));
    setRemovedPhotos(current => current.includes(path) ? current : [...current, path]);
  }

  async function saveEquipment(event) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    const serial = equipmentForm.serial_number.trim();
    const imei = (equipmentForm.imei || "").trim();
    if (serial.length < 3 && imei.length < 3) {
      setDashboardNotice("Digite um número de série (SN) ou IMEI válido.");
      return;
    }
    if (imei && !/^\d{15}$/.test(imei)) {
      setDashboardNotice("O IMEI deve conter exatamente 15 algarismos.");
      return;
    }
    if (existingPhotos.length + selectedPhotos.length < 2 || existingPhotos.length + selectedPhotos.length > 4) {
      setDashboardNotice("Adicione pelo menos 2 fotos reais do equipamento (máximo 4).");
      return;
    }
    if (!ownershipConfirmation) {
      setDashboardNotice("Confirme a declaração de responsabilidade pelas fotos antes de continuar.");
      return;
    }
    if (purchaseProofFile && (!["application/pdf","image/jpeg","image/png","image/webp"].includes(purchaseProofFile.type) || purchaseProofFile.size > 10 * 1024 * 1024)) {
      setDashboardNotice("O comprovativo deve ser PDF, JPG, PNG ou WebP e ter no máximo 10 MB.");
      return;
    }
    setLoading(true);
    setDashboardNotice("");
    let equipmentId = editingId;
    let cleanupWarning = "";
    try {
      const payload = {
        ...equipmentForm, name: equipmentForm.name.trim(), serial_number: serial, imei: imei || null,
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
        if (blob.size > 2 * 1024 * 1024) throw new Error("Uma foto continua acima de 2 MB. Escolha uma imagem mais pequena.");
        const path = session.user.id + "/" + equipmentId + "/" + crypto.randomUUID() + ".jpg";
        const { error } = await supabase.storage.from(bucketName).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
      }
      const paths = [...existingPhotos.map(photo => photo.path), ...uploadedPaths];
      const documentUpdate = {};
      if (purchaseProofFile) {
        const extension = purchaseProofFile.type === "application/pdf" ? "pdf" : purchaseProofFile.type === "image/png" ? "png" : purchaseProofFile.type === "image/webp" ? "webp" : "jpg";
        const documentPath = session.user.id + "/" + equipmentId + "/" + crypto.randomUUID() + "." + extension;
        const { error: documentError } = await supabase.storage.from(documentBucketName).upload(documentPath, purchaseProofFile, { contentType: purchaseProofFile.type, upsert: false });
        if (documentError) throw documentError;
        documentUpdate.invoice_path = documentPath;
        documentUpdate.invoice_file_name = purchaseProofFile.name;
        if (existingPurchaseProof?.path) {
          const { error: oldDocumentError } = await supabase.storage.from(documentBucketName).remove([existingPurchaseProof.path]);
          if (oldDocumentError) cleanupWarning = " O novo comprovativo foi guardado, mas o arquivo anterior não pôde ser removido.";
        }
      }
      const { error: imageError } = await supabase.from("equipments").update({ image_paths: paths, ...documentUpdate }).eq("id", equipmentId);
      if (imageError) throw imageError;
      if (removedPhotos.length) {
        const { error: cleanupError } = await supabase.storage.from(bucketName).remove(removedPhotos);
        if (cleanupError) cleanupWarning = " O cadastro foi guardado, mas algumas fotos antigas não puderam ser removidas.";
      }
      setShowForm(false);
      setEditingId(null);
      setEquipmentForm(emptyEquipment);
      setSelectedPhotos([]);
      setExistingPhotos([]);
      setRemovedPhotos([]);
      setPurchaseProofFile(null);
      setExistingPurchaseProof(null);
      setOwnershipConfirmation(false);
      await loadEquipment();
      setDashboardNotice((editingId ? "Equipamento atualizado com sucesso." : "Equipamento cadastrado com sucesso.") + cleanupWarning);
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
      let cleanupWarning = "";
      const paths = Array.isArray(item.image_paths) ? item.image_paths : [];
      if (paths.length) {
        const { error: cleanupError } = await supabase.storage.from(bucketName).remove(paths);
        if (cleanupError) cleanupWarning = " O cadastro foi eliminado, mas algumas fotos antigas não puderam ser removidas.";
      }
      if (item.invoice_path) {
        const { error: documentCleanupError } = await supabase.storage.from(documentBucketName).remove([item.invoice_path]);
        if (documentCleanupError) cleanupWarning += " O comprovativo de compra não pôde ser removido.";
      }
      setEquipment(current => current.filter(entry => entry.id !== item.id));
      setDashboardNotice("Equipamento eliminado." + cleanupWarning);
    }
  }

  async function lookupEquipment(event) {
    event.preventDefault();
    if (!supabase) {
      setLookupResult({ error: "A consulta está temporariamente indisponível. Tente novamente mais tarde." });
      return;
    }
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const serial = lookupSerial.trim();
      if (serial.length < 3) throw new Error("Digite um número de série (SN) ou IMEI válido.");
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
    setAdminAccessMode(false);
    if (supabase) await supabase.auth.signOut();
    setShowForm(false);
    setDashboardNotice("");
    setNotice("");
  }

  const filteredEquipment = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return equipment;
    return equipment.filter(item => [item.name, item.category, item.brand, item.model, item.serial_number, item.imei, item.status]
      .some(value => (value || "").toLowerCase().includes(term)));
  }, [equipment, search]);

  if (isAdminRoute && session?.user && adminChecking) {
    return <main className="page-shell"><section className="login-card"><div className="brand"><div className="brand-name">PROTEGE</div><div className="brand-tagline">A verificar autorização</div></div><p className="muted-copy">A confirmar as permissões administrativas no servidor...</p></section></main>;
  }

  if (isAdminRoute && session?.user && !adminChecking && !isAdmin) {
    return <main className="page-shell"><section className="login-card"><div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Área reservada</div></div><div className="form-heading"><h1>Acesso não autorizado</h1><p>Esta conta não tem permissões para aceder à área de administração.</p></div><button className="primary-button" onClick={() => { window.location.href = "/"; }}>Voltar à PROTEGE</button></section></main>;
  }

  if (isAdminRoute && session?.user && !adminChecking && isAdmin) {
    return adminAccessMode
      ? <AdminAccessPanel supabase={supabase} user={session.user} onSignOut={signOut} onBack={() => setAdminAccessMode(false)} />
      : <AdminDashboard supabase={supabase} user={session.user} onSignOut={signOut} onManageAccess={() => setAdminAccessMode(true)} />;
  }

  if (isAdminRoute && !session?.user) {
    return (
      <main className="page-shell admin-login-shell">
        <section className="login-card admin-login-card">
          <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div className="brand-name">PROTEGE</div><div className="brand-tagline">Administração privada</div></div>
          <div className="form-heading"><h1>Acesso administrativo</h1><p>Entre com as credenciais de uma conta administrativa autorizada.</p></div>
          <form onSubmit={submit} autoComplete="on">
            <label htmlFor="email">Nome de usuário ou email</label><input id="email" name="username" type="text" autoComplete="username" placeholder="admin" value={email} onChange={e=>setEmail(e.target.value)} required disabled={loading}/>
            <label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Digite a senha" value={password} onChange={e=>setPassword(e.target.value)} required disabled={loading}/>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? "A verificar..." : "Entrar na administração"}</button>
            {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
          </form>
          <p className="admin-login-note">Área restrita. Não existe cadastro público de administradores.</p>
        </section>
      </main>
    );
  }

  if (session?.user && (profileLoading || profileUserId !== session.user.id)) {
    return <main className="page-shell"><section className="login-card"><div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div className="brand-name">PROTEGE</div><div className="brand-tagline">A preparar a sua conta...</div></div><p className="muted-copy">Estamos a verificar os dados do seu perfil.</p></section></main>;
  }

  if (session?.user) {
    const profileComplete = Boolean(profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.phone?.trim() && profile?.country?.trim());
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
            <div><div className="brand-name">PROTEGE</div><div className="brand-tagline">cadastro e proteção de equipamentos</div></div>
          </div>
          <div className="user-actions">
            {profilePhotoUrl ? <img className="profile-avatar" src={profilePhotoUrl} alt="foto de perfil"/> : <span className="profile-avatar profile-avatar-empty" aria-hidden="true">{profile?.first_name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}</span>}
            <span className="user-email">{profile?.first_name ? profile.first_name + " " + (profile.last_name || "") : session.user.email}</span>
            <button className="outline-button" onClick={() => { setProfileNotice(""); setProfilePhoto(null); setShowAccount(true); }}>Sua conta</button>
            <button className="outline-button" onClick={signOut}>Terminar sessão</button>
          </div>
        </header>
        <section className="dashboard-content">
          {showAccount && <div className={!profileComplete ? "account-overlay" : "account-editor-wrap"}><section className="equipment-form-card account-card">
            <div className="form-card-heading"><div><h2>{profileComplete ? "Sua conta" : "Preencha seus dados"}</h2><p>{profileComplete ? "Pode atualizar estes dados sempre que precisar." : "Antes de continuar, complete os dados obrigatórios do seu perfil."}</p></div>{profileComplete && <button className="close-button" type="button" onClick={() => { setShowAccount(false); setProfileNotice(""); }} aria-label="Fechar">×</button>}</div>
            {profileLoading ? <p className="muted-copy">A carregar os dados da conta...</p> : <form className="equipment-form" onSubmit={saveProfile}>
              {profileNotice && <p className="dashboard-notice" role="status">{profileNotice}</p>}
              <div className="profile-photo-editor">
                {profilePhoto ? <img className="profile-photo-large" src={URL.createObjectURL(profilePhoto)} alt="Pré-visualização da foto de perfil"/> : !removeProfilePhoto && profilePhotoUrl ? <img className="profile-photo-large" src={profilePhotoUrl} alt="foto de perfil atual"/> : <div className="profile-photo-large profile-avatar-empty">{profileForm.first_name?.[0]?.toUpperCase() || "U"}</div>}
                <div className="profile-photo-fields"><label htmlFor="profile-photo">foto de perfil (opcional)</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setProfilePhoto(e.target.files?.[0] || null); if (e.target.files?.[0]) setRemoveProfilePhoto(false); }}/><p className="field-help">JPG, PNG ou WebP. Máximo 2 MB após compressão.</p>{(profile?.profile_photo_path || profilePhoto) && <button type="button" className="text-button" onClick={() => { setProfilePhoto(null); setRemoveProfilePhoto(Boolean(profile?.profile_photo_path)); }}>Remover foto</button>}</div>
              </div>
              <div className="field-grid">
                <div><label htmlFor="profile-first-name">Nome *</label><input id="profile-first-name" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name:e.target.value})} autoComplete="given-name" maxLength={100} required/></div>
                <div><label htmlFor="profile-last-name">Sobrenome *</label><input id="profile-last-name" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name:e.target.value})} autoComplete="family-name" maxLength={100} required/></div>
                <div><label htmlFor="profile-phone">celular *</label><input id="profile-phone" type="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone:e.target.value})} autoComplete="tel" placeholder="+351 912 345 678" maxLength={30} required/></div>
                <div><label htmlFor="profile-country">País *</label><input id="profile-country" value={profileForm.country} onChange={e => setProfileForm({...profileForm, country:e.target.value})} autoComplete="country-name" placeholder="Portugal" maxLength={100} required/></div>
                <div><label htmlFor="profile-birth">Data de nascimento (opcional)</label><input id="profile-birth" type="date" value={profileForm.date_of_birth} onChange={e => setProfileForm({...profileForm, date_of_birth:e.target.value})} max={new Date().toISOString().slice(0,10)}/></div>
                <div><label htmlFor="profile-city">Cidade (opcional)</label><input id="profile-city" value={profileForm.city} onChange={e => setProfileForm({...profileForm, city:e.target.value})} autoComplete="address-level2" maxLength={100}/></div>
              </div>
              <section className="password-section user-password-section">
                <h3>Alterar senha</h3>
                <p className="field-help">Preencha os três campos para alterar a senha. A nova senha deve ter pelo menos 12 caracteres.</p>
                <div className="field-grid">
                  <div className="password-field"><label htmlFor="user-current-password">Senha antiga</label><div className="password-input-wrap"><input id="user-current-password" type={showUserPasswords ? "text" : "password"} autoComplete="current-password" value={currentUserPassword} onChange={e=>setCurrentUserPassword(e.target.value)} placeholder="Senha atual"/><button type="button" className="password-visibility" onClick={()=>setShowUserPasswords(v=>!v)} aria-label={showUserPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showUserPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
                  <div className="password-field"><label htmlFor="user-new-password">Nova senha</label><div className="password-input-wrap"><input id="user-new-password" type={showUserPasswords ? "text" : "password"} autoComplete="new-password" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)} placeholder="Mínimo de 12 caracteres" minLength={12}/><button type="button" className="password-visibility" onClick={()=>setShowUserPasswords(v=>!v)} aria-label={showUserPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showUserPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
                  <div className="password-field"><label htmlFor="user-confirm-password">Confirmar nova senha</label><div className="password-input-wrap"><input id="user-confirm-password" type={showUserPasswords ? "text" : "password"} autoComplete="new-password" value={confirmUserPassword} onChange={e=>setConfirmUserPassword(e.target.value)} placeholder="Repita a nova senha" minLength={12}/><button type="button" className="password-visibility" onClick={()=>setShowUserPasswords(v=>!v)} aria-label={showUserPasswords ? "Ocultar palavras-passe" : "Mostrar palavras-passe"}>{showUserPasswords ? <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
                </div>
              </section>
              <div className="form-actions"><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "A guardar..." : "Guardar dados e senha"}</button></div>
            </form>}
          </section></div>}
          <div className="dashboard-welcome">
            <div><p className="eyebrow">PAINEL DE CONTROLO</p><h1>{activeTab === "mine" ? "Os meus equipamentos" : activeTab === "lookup" ? "Consultar equipamento" : "Suporte direto"}</h1><p className="muted-copy">{activeTab === "support" ? "Converse diretamente com a equipa PROTEGE, sem preencher formulários." : "Organize os seus bens e consulte o estado de proteção dos equipamentos."}</p></div>
            {activeTab === "mine" && <button className="primary-button add-button" onClick={startNewEquipment}>＋ cadastrar equipamento</button>}
          </div>
          <nav className="dashboard-tabs" aria-label="Secções da PROTEGE">
            <button className={"dashboard-tab " + (activeTab === "mine" ? "active" : "")} onClick={() => setActiveTab("mine")}>Os meus equipamentos</button>
            <button className={"dashboard-tab " + (activeTab === "lookup" ? "active" : "")} onClick={() => setActiveTab("lookup")}>Consultar equipamento</button>
            <button className={"dashboard-tab " + (activeTab === "support" ? "active" : "")} onClick={() => setActiveTab("support")}>Suporte</button>
          </nav>
          {dashboardNotice && <p className="dashboard-notice" role="status">{dashboardNotice}</p>}

          {activeTab === "mine" && <>
            <div className="stats-grid">
              <article className="stat-card"><span>Total de equipamentos</span><strong>{counts.total}</strong></article>
              <article className="stat-card"><span>Ativos</span><strong>{counts.active}</strong></article>
              <article className="stat-card"><span>Perdidos ou roubados</span><strong>{counts.alert}</strong></article>
            </div>
            {showForm && <section className="equipment-form-card">
              <div className="form-card-heading"><div><h2>{editingId ? "Editar equipamento" : "cadastrar equipamento"}</h2><p>Preencha os dados e adicione 2 a 4 fotos como prova do equipamento.</p></div><button className="close-button" type="button" onClick={() => setShowForm(false)} aria-label="Fechar">×</button></div>
              <form className="equipment-form" onSubmit={saveEquipment}>
                <div className="field-grid">
                  <div className="field-full"><label htmlFor="eq-name">Nome do equipamento *</label><input id="eq-name" value={equipmentForm.name} onChange={e => setEquipmentForm({...equipmentForm, name:e.target.value})} placeholder="Ex.: iPhone 15, portátil, bicicleta" required maxLength={120}/></div>
                  <div><label htmlFor="eq-category">Categoria</label><select id="eq-category" value={equipmentForm.category} onChange={e => setEquipmentForm({...equipmentForm, category:e.target.value})}>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
                  <div><label htmlFor="eq-status">Estado</label><select id="eq-status" value={equipmentForm.status} onChange={e => setEquipmentForm({...equipmentForm, status:e.target.value})}>{statuses.map(value => <option key={value}>{value}</option>)}</select></div>
                  <div><label htmlFor="eq-brand">Marca</label><input id="eq-brand" value={equipmentForm.brand} onChange={e => setEquipmentForm({...equipmentForm, brand:e.target.value})} placeholder="Ex.: Apple" maxLength={100}/></div>
                  <div><label htmlFor="eq-model">Modelo</label><input id="eq-model" value={equipmentForm.model} onChange={e => setEquipmentForm({...equipmentForm, model:e.target.value})} placeholder="Ex.: iPhone 15 Pro" maxLength={100}/></div>
                  <div className="field-full"><label htmlFor="eq-serial">Número de série (SN)</label><input id="eq-serial" value={equipmentForm.serial_number} onChange={e => setEquipmentForm({...equipmentForm, serial_number:e.target.value})} placeholder="Digite o número de série (SN)" maxLength={160}/><label htmlFor="eq-imei">IMEI</label><input id="eq-imei" value={equipmentForm.imei || ""} onChange={e => setEquipmentForm({...equipmentForm, imei:e.target.value.replace(/[^0-9]/g, "").slice(0, 16)})} placeholder="Digite o IMEI (15 dígitos, se aplicável)" inputMode="numeric" maxLength={16}/><p className="field-help">Preencha o SN, o IMEI ou ambos. O IMEI é usado principalmente em telemóveis e alguns equipamentos com ligação móvel.</p></div>
                  <div className="field-full"><label htmlFor="eq-description">Notas / descrição</label><textarea id="eq-description" rows="3" value={equipmentForm.description} onChange={e => setEquipmentForm({...equipmentForm, description:e.target.value})} placeholder="Características, acessórios ou outros detalhes" maxLength={1500}/></div>
                  <div className="field-full"><label htmlFor="eq-photos">fotos do equipamento * (mínimo 2, máximo 4)</label><input id="eq-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos}/><p className="field-help">Obrigatório: pelo menos 2 fotos do próprio equipamento. Mostre o equipamento e uma foto legível do SN ou IMEI. Sem as fotos não é possível cadastrar. Os arquivos ficam privados.</p></div>
                  <div className="field-full"><label htmlFor="eq-purchase-proof">Fatura/ fatura-recibo ou comprovativo de compra (opcional)</label><input id="eq-purchase-proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setPurchaseProofFile(e.target.files?.[0] || null)}/><p className="field-help">Pode anexar uma fatura, fatura-recibo ou comprovativo de compra em PDF, JPG, PNG ou WebP (máximo 10 MB). Este documento ficará privado e poderá ajudar a comprovar a propriedade.</p>{existingPurchaseProof && !purchaseProofFile && <p className="field-help">Comprovativo atual: {existingPurchaseProof.name}. Se selecionar outro arquivo, será substituído.</p>}{purchaseProofFile && <p className="field-help">Novo arquivo: {purchaseProofFile.name}</p>}</div>
                  <div className="field-full ownership-confirmation"><label><input type="checkbox" checked={ownershipConfirmation} onChange={e=>setOwnershipConfirmation(e.target.checked)} required/> <span>Declaro que as imagens são reais, correspondem ao equipamento que estou a cadastrar e mostram o equipamento e o respetivo número de série (SN) ou IMEI de forma visível. Confirmo que as informações fornecidas são verdadeiras e responsabilizo-me pela sua autenticidade.</span></label></div>
                </div>
                {(existingPhotos.length + selectedPhotos.length > 0) && <div className="photo-grid">
                  {existingPhotos.map(photo => <div className="photo-preview" key={photo.path}><img src={photo.url} alt="foto guardada do equipamento"/><button type="button" onClick={() => removeExistingPhoto(photo.path)} aria-label="Remover foto">×</button></div>)}
                  {selectedPhotos.map((photo, index) => <div className="photo-preview" key={photo.name + index}><img src={URL.createObjectURL(photo)} alt={photo.name}/><button type="button" onClick={() => setSelectedPhotos(current => current.filter((_, i) => i !== index))} aria-label="Remover foto">×</button></div>)}
                </div>}
                <p className="field-help">{existingPhotos.length + selectedPhotos.length} de 4 fotos selecionadas.</p>
                <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={loading}>{loading ? "A guardar..." : editingId ? "Guardar alterações" : "Guardar equipamento"}</button></div>
              </form>
            </section>}
            <section className="equipment-list-card">
              <div className="list-heading"><div><h2>Equipamentos cadastrados</h2><p>{equipment.length} {equipment.length === 1 ? "equipamento" : "equipamentos"} na sua conta</p></div><input className="search-input" aria-label="Pesquisar equipamentos" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}/></div>
              {loadingEquipment ? <div className="empty-state">A carregar os seus equipamentos...</div> :
                filteredEquipment.length === 0 ? <div className="empty-state"><div className="empty-icon">⌕</div><h3>{equipment.length ? "Nenhum resultado encontrado" : "Ainda não registou equipamentos"}</h3><p>{equipment.length ? "Experimente pesquisar por outro nome, marca ou número de série." : "Comece por cadastrar o seu primeiro equipamento para ter os dados organizados."}</p>{!equipment.length && <button className="primary-button" onClick={startNewEquipment}>＋ cadastrar primeiro equipamento</button>}</div> :
                <div className="equipment-table-wrap"><table className="equipment-table"><thead><tr><th>Equipamento</th><th>Categoria</th><th>SN / IMEI</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{filteredEquipment.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span className="table-subtitle">{[item.brand,item.model].filter(Boolean).join(" · ") || "Sem marca/modelo"}</span></td><td>{item.category}</td><td><span className="table-subtitle">SN: {item.serial_number || "—"}</span><span className="table-subtitle">IMEI: {item.imei || "—"}</span></td><td><span className={"status-pill status-" + item.status.toLowerCase()}>{item.status}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => startEdit(item)}>Editar</button><button className="delete-button" onClick={() => deleteEquipment(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div>}
            </section>
          </>}

          {activeTab === "support" && <SupportChat supabase={supabase} user={session.user} />}

          {activeTab === "lookup" && <section className="equipment-list-card">
            <form className="lookup-form" onSubmit={lookupEquipment}>
              <div className="form-card-heading"><div><h2>Consultar pelo número de série</h2><p>Digite o número de série (SN) ou o IMEI para verificar o cadastro e eventuais restrições.</p></div></div>
              <div className="lookup-input-row"><input aria-label="Número de série ou IMEI para consulta" value={lookupSerial} onChange={e => setLookupSerial(e.target.value)} placeholder="SN ou IMEI" minLength={3} maxLength={160} required/><button className="primary-button" type="submit" disabled={lookupLoading}>{lookupLoading ? "A consultar..." : "Consultar"}</button></div>
            </form>
            {lookupResult && (() => {
              const restricted = lookupResult.found && (lookupResult.status === "Roubado" || lookupResult.restriction_status === "Com restrição");
              return <div className={"lookup-result-card " + (lookupResult.error ? "lookup-not-found" : !lookupResult.found ? "lookup-not-found" : restricted ? "restriction-red" : "restriction-green")}>
                {lookupResult.error ? <><strong>Não foi possível consultar</strong><p>{lookupResult.error}</p></> :
                  !lookupResult.found ? <><strong>Nenhum cadastro encontrado</strong><p>Não foi encontrado um equipamento com esse número de série.</p></> :
                  <><span className="lookup-status">{restricted ? "COM RESTRIÇÃO" : "SEM RESTRIÇÃO"}</span><strong>{lookupResult.name}</strong><p>{restricted ? (lookupResult.status === "Roubado" ? "ATENÇÃO: este equipamento está cadastrado como roubado." : "ATENÇÃO: este equipamento tem uma restrição cadastrada na PROTEGE.") : "Não existe uma restrição assinalada neste cadastro."}</p></>}
              </div>;
            })()}
          </section>}

          <p className="privacy-note">Os seus equipamentos e fotos são protegidos por regras de acesso.</p>
        </section>
        <footer>PROTEGE · cadastro e proteção de equipamentos</footer>
      </main>
    );
  }


  async function submitSupportMessage(event) {
    event.preventDefault(); setSupportNotice(""); setSupportError("");
    if (!supabase) { setSupportError("O serviço está temporariamente indisponível."); return; }
    setSupportSending(true);
    let uploadedPath = null;
    try {
      const name=supportForm.name.trim(), emailValue=supportForm.email.trim(), subject=supportForm.subject.trim(), messageValue=supportForm.message.trim();
      if(name.length<2||emailValue.length<5||subject.length<3||messageValue.length<10) throw new Error("Preencha todos os campos obrigatórios.");
      if(supportFile) {
        if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(supportFile.type)) throw new Error("O anexo deve ser JPG, PNG, WebP ou PDF.");
        if(supportFile.size>5*1024*1024) throw new Error("O anexo deve ter no máximo 5 MB.");
        uploadedPath="incoming/"+crypto.randomUUID()+"-"+supportFile.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
        const uploaded=await supabase.storage.from("support-attachments").upload(uploadedPath,supportFile,{contentType:supportFile.type,upsert:false});
        if(uploaded.error) throw uploaded.error;
      }
      const result=await supabase.from("support_messages").insert({name,email:emailValue,subject,message:messageValue,attachment_path:uploadedPath,attachment_name:supportFile?.name||null,user_id:session?.user?.id||null,status:"new"});
      if(result.error) throw result.error;
      setSupportForm({name:"",email:"",subject:"",message:""}); setSupportFile(null);
      const fileInput=document.getElementById("support-attachment"); if(fileInput) fileInput.value="";
      setSupportNotice("Mensagem enviada com sucesso. A equipa PROTEGE irá analisar o pedido.");
    } catch(e) {
      if(uploadedPath) await supabase.storage.from("support-attachments").remove([uploadedPath]);
      setSupportError(e.message||"Não foi possível enviar a mensagem.");
    } finally { setSupportSending(false); }
  }


  if (supportPage && landingMode && screen === "login") {
    return <main className="protege-landing help-page support-page">
      <header className="landing-header"><a className="landing-brand" href="/" onClick={e=>{e.preventDefault();setSupportPage(false);}}><span className="landing-brand-shield"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></span><span>PROTEGE</span></a><div className="landing-actions"><button className="landing-login-button" onClick={()=>setSupportPage(false)}>Voltar ao início</button></div></header>
      <section className="help-hero"><p className="landing-kicker">APOIO AO Usuário</p><h1>Fale com o <span>suporte</span></h1><p>Envie a sua dúvida ou descreva o problema. Pode anexar uma imagem ou documento para ajudar a equipa a compreender a situação.</p><div className="help-notice"><strong>Como funciona?</strong><span>A mensagem será recebida na área administrativa da PROTEGE. Indique um email válido para eventual contacto.</span></div></section>
      <section className="support-form-wrap">
        {supportError&&<p className="dashboard-notice admin-error" role="alert">{supportError}</p>}{supportNotice&&<p className="dashboard-notice" role="status">{supportNotice}</p>}
        <form className="support-form" onSubmit={submitSupportMessage}>
          <div className="field-grid"><div><label htmlFor="support-name">Nome</label><input id="support-name" autoComplete="name" value={supportForm.name} onChange={e=>setSupportForm({...supportForm,name:e.target.value})} minLength={2} maxLength={120} required placeholder="O seu nome"/></div><div><label htmlFor="support-email">email para contacto</label><input id="support-email" type="email" autoComplete="email" value={supportForm.email} onChange={e=>setSupportForm({...supportForm,email:e.target.value})} maxLength={254} required placeholder="nome@exemplo.pt"/></div></div>
          <div><label htmlFor="support-subject">Assunto</label><input id="support-subject" value={supportForm.subject} onChange={e=>setSupportForm({...supportForm,subject:e.target.value})} minLength={3} maxLength={160} required placeholder="Ex.: problema ao cadastrar um equipamento"/></div>
          <div><label htmlFor="support-message">Mensagem</label><textarea id="support-message" value={supportForm.message} onChange={e=>setSupportForm({...supportForm,message:e.target.value})} minLength={10} maxLength={5000} rows={7} required placeholder="Explique como podemos ajudar..."/></div>
          <div><label htmlFor="support-attachment">Anexo (opcional)</label><input id="support-attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setSupportFile(e.target.files?.[0]||null)}/><p className="field-help">JPG, PNG, WebP ou PDF, até 5 MB. Não envie palavras-passe nem documentos desnecessários.</p></div>
          <div className="support-form-actions"><button className="landing-signup-button" type="submit" disabled={supportSending}>{supportSending?"A enviar...":"Enviar mensagem"}</button><button className="landing-login-button" type="button" onClick={()=>setSupportPage(false)}>Cancelar</button></div>
          <p className="support-privacy-note">Os anexos ficam em armazenamento privado e o acesso é reservado a administradores autorizados. Nesta versão, o envio regista o pedido na plataforma; não envia email automaticamente.</p>
        </form>
      </section><footer className="landing-footer">PROTEGE · Apoio ao usuário</footer>
    </main>;
  }

  if (helpPage && landingMode && screen === "login") {
    return (
      <main className="protege-landing help-page">
        <header className="landing-header">
          <a className="landing-brand" href="/" onClick={e=>{e.preventDefault();setHelpPage(false);}} aria-label="PROTEGE - Início">
            <span className="landing-brand-shield"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></span><span>PROTEGE</span>
          </a>
          <div className="landing-actions"><button className="landing-login-button" onClick={()=>setHelpPage(false)}>← Voltar ao início</button><button className="landing-signup-button" onClick={()=>{setHelpPage(false);changeScreen("register");}}>Criar conta</button></div>
        </header>
        <section className="help-hero">
          <p className="landing-kicker">INFORMAÇÃO · SEGURANÇA · COMUNIDADE</p>
          <h1>Como funciona a <span>PROTEGE</span>?</h1>
          <p>Uma forma simples de cadastrar os seus equipamentos, reforçar a prova de posse e ajudar a que equipamentos furtados ou roubados possam ser identificados e devolvidos.</p>
          <div className="help-notice"><strong>Gratuita e orientada para a privacidade</strong><span>A PROTEGE foi concebida para permitir o cadastro e a consulta de equipamentos sem expor publicamente os dados pessoais dos seus proprietários.</span></div>
        </section>
        <section className="help-content">
          <div className="help-section-title"><span>01</span><div><h2>Como a PROTEGE ajuda</h2><p>O cadastro cria um histórico que pode ajudar a esclarecer a situação de um equipamento.</p></div></div>
          <div className="help-steps">
            <article><span className="help-step-icon">＋</span><h3>1. Registe o equipamento</h3><p>Crie uma conta e adicione os dados do equipamento. Junte entre duas e quatro fotos reais, incluindo imagens do equipamento e do respetivo número de série (SN) ou IMEI.</p></article>
            <article><span className="help-step-icon">▣</span><h3>2. Guarde um cadastro de posse</h3><p>O cadastro, os dados introduzidos e as fotos podem servir como elementos de apoio para demonstrar que o equipamento estava na sua posse. Não substituem uma fatura, participação policial ou outra prova legal.</p></article>
            <article><span className="help-step-icon">⌕</span><h3>3. Consulte antes de comprar</h3><p>Digite o SN ou IMEI na Consulta rápida. Se existir uma restrição cadastrada, a página informa que o equipamento tem uma situação assinalada, sem divulgar os dados pessoais do proprietário.</p></article>
            <article><span className="help-step-icon">↗</span><h3>4. Ajude a resolver a situação</h3><p>As consultas ficam cadastradas no sistema. Se a consulta for feita por uma pessoa com conta e houver dados suficientes para um contacto seguro, a PROTEGE poderá contactá-la para tentar facilitar a comunicação entre as partes. O contacto não garante a recuperação do equipamento.</p></article>
          </div>
          <div className="help-privacy"><div className="help-privacy-icon">✓</div><div><h2>Privacidade e segurança</h2><p>Os dados da conta e as fotos de prova não são apresentados na consulta pública. O acesso às informações privadas é limitado por regras de segurança. Nunca partilhe a sua senha e, em caso de furto ou roubo, participe a ocorrência às autoridades e guarde o comprovativo.</p></div></div>
          <div className="help-section-title"><span>02</span><div><h2>Como descobrir o IMEI do smartphone ou tablet</h2><p>O IMEI é um identificador do equipamento móvel. Em dispositivos com dois cartões SIM, podem existir dois IMEI.</p></div></div>
          <div className="help-imei-card">
            <div className="help-phone-illustration" aria-label="Ilustração de um smartphone a mostrar o código para consultar o IMEI">
              <svg viewBox="0 0 220 300" role="img" aria-labelledby="phone-title"><title id="phone-title">Marque asterisco, cardinal, zero, seis, cardinal para consultar o IMEI</title><rect x="34" y="5" width="152" height="286" rx="25" fill="#102944" stroke="#4bbcff" strokeWidth="3"/><rect x="45" y="27" width="130" height="238" rx="15" fill="#f6fbff"/><rect x="85" y="15" width="50" height="5" rx="3" fill="#4bbcff"/><text x="110" y="61" textAnchor="middle" fontSize="11" fill="#52708d">Telefone</text><rect x="58" y="77" width="104" height="55" rx="9" fill="#e4f3ff"/><text x="110" y="111" textAnchor="middle" fontSize="28" fontWeight="800" fill="#087bd3">*#06#</text><g fill="#dce8f2">{[0,1,2].map((r)=>[0,1,2].map((c)=><rect key={r+"-"+c} x={62+c*34} y={148+r*30} width="27" height="22" rx="6"/>))}</g><rect x="62" y="239" width="96" height="14" rx="7" fill="#dce8f2"/></svg>
            </div>
            <div className="help-imei-instructions"><span className="help-pill">Método mais rápido</span><h3>Marque <code>*#06#</code> na aplicação Telefone</h3><ol><li>Abra a aplicação onde costuma fazer chamadas.</li><li>Marque <strong>*#06#</strong> no teclado numérico.</li><li>O IMEI deverá aparecer automaticamente no ecrã, sem precisar de efetuar a chamada.</li><li>Copie o número para o cadastro PROTEGE e confirme que está correto.</li></ol><p className="help-caution">Não publique o IMEI nas redes sociais. Digite-o apenas em serviços em que confia.</p><p>Também pode encontrar o IMEI nas definições do dispositivo, na caixa original ou na documentação de compra, dependendo do modelo.</p></div>
          </div>
          <div className="help-section-title"><span>03</span><div><h2>Bicicletas elétricas e trotinetes</h2><p>Procure o número de série (SN), o número de quadro ou chassis indicado pelo fabricante.</p></div></div>
          <div className="help-serial-card">
            <div className="help-serial-illustration"><svg viewBox="0 0 340 190" role="img" aria-label="Ilustração de uma bicicleta elétrica com indicação de onde procurar o número de série"><circle cx="68" cy="133" r="40" fill="none" stroke="#244968" strokeWidth="6"/><circle cx="267" cy="133" r="40" fill="none" stroke="#244968" strokeWidth="6"/><path d="M68 133 122 74 165 133H68L145 133 197 70 267 133M122 74h45M197 70l-20-12M185 70h30" fill="none" stroke="#21a8f4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/><rect x="114" y="99" width="48" height="18" rx="5" fill="#d7f0ff" stroke="#087bd3" strokeWidth="2"/><path d="M138 99 138 51 214 51" fill="none" stroke="#087bd3" strokeWidth="2" strokeDasharray="4 4"/><rect x="207" y="35" width="120" height="32" rx="7" fill="#087bd3"/><text x="267" y="55" fontSize="11" fontWeight="800" textAnchor="middle" fill="#fff">N.º DE SÉRIE</text><text x="170" y="185" fontSize="10" textAnchor="middle" fill="#64819a">Ilustração indicativa — a localização varia</text></svg></div>
            <div><h3>Onde procurar</h3><ul><li>Na parte inferior do quadro ou junto ao eixo dos pedais.</li><li>Na zona de ligação entre o quadro e a bateria.</li><li>Na parte inferior ou lateral do chassis da trotinete.</li><li>Na etiqueta do fabricante, no manual ou na fatura.</li></ul><p>O local muda conforme a marca e o modelo. Procure as indicações <strong>SN</strong>, <strong>Serial Number</strong>, <strong>Frame Number</strong> ou <strong>Chassis</strong>. Não confunda o número de série com o número do modelo.</p></div>
          </div>
          <div className="help-final-cta"><h2>Proteja o que é seu.</h2><p>Registe os seus equipamentos e ajude a construir uma comunidade mais informada e atenta.</p><button className="landing-signup-button" onClick={()=>{setHelpPage(false);changeScreen("register");}}>Criar conta gratuita</button><button className="landing-login-button" onClick={()=>setHelpPage(false)}>Voltar à página inicial</button></div>
        </section>
        <footer className="landing-footer">PROTEGE · cadastro e proteção de equipamentos <span>Privacidade, prevenção e colaboração.</span></footer>
      </main>
    );
  }

  if (landingMode && screen === "login") {
    return (
      <main className="protege-landing">
        <header className="landing-header">
          <a className="landing-brand" href="/" aria-label="PROTEGE - Início">
            <span className="landing-brand-shield"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></span>
            <span>PROTEGE</span>
          </a>
          <nav className="landing-nav" aria-label="Navegação principal">
            <a className="active" href="#inicio">Início</a><a href="#consultar">Consultar</a><a href="/como-funciona" onClick={e=>{e.preventDefault();setHelpPage(true);}}>Como funciona</a><a href="/ajuda" onClick={e=>{e.preventDefault();setSupportPage(true);setSupportNotice("");setSupportError("");}}>Ajuda</a>
          </nav>
          <div className="landing-actions"><button className="landing-login-button" onClick={()=>setLandingMode(false)}><span aria-hidden="true">↪</span> Entrar</button><button className="landing-signup-button" onClick={()=>changeScreen("register")}><span aria-hidden="true">♙</span> Criar conta</button></div>
        </header>
        <section className="landing-hero" id="inicio">
          <div className="landing-art" aria-hidden="true"><img src="/protege-tech-visual.svg" alt="" fetchPriority="high"/></div>
          <div className="landing-copy">
            <div className="landing-kicker"><span className="landing-mini-shield"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></span> SEGURANÇA PARA O SEU DIA A DIA</div>
            <h1>PROTEGE</h1>
            <h2>Cadastre seus equipamentos<br/>e <span>aumente sua segurança.</span></h2>
            <p className="landing-description">Uma plataforma em Portugal para cadastro e consulta de equipamentos eletrónicos, ajudando no combate ao furto e roubo.</p>
            <form className="landing-lookup" id="consultar" onSubmit={lookupEquipment}>
              <label className="landing-lookup-title" htmlFor="landing-serial">Consulta rápida</label>
              <input id="landing-serial" aria-label="Número de série para consulta" value={lookupSerial} onChange={e=>setLookupSerial(e.target.value)} placeholder="Digite o SN ou IMEI para consultar" minLength={3} maxLength={160} required/>
              <button type="submit" disabled={lookupLoading}>{lookupLoading ? "A consultar..." : "Consultar"}</button>
            </form>
            {lookupResult && <div className={"landing-lookup-result "+(lookupResult.error||!lookupResult.found?"lookup-not-found":lookupResult.status==="Roubado"||lookupResult.restriction_status==="Com restrição"?"restriction-red":"restriction-green")}>
              {lookupResult.error ? <><strong>Não foi possível consultar</strong><p>{lookupResult.error}</p></> : !lookupResult.found ? <><strong>Nenhum cadastro encontrado</strong><p>Não foi encontrado um equipamento com esse número de série.</p></> : <><span className="lookup-status">{lookupResult.status==="Roubado"||lookupResult.restriction_status==="Com restrição"?"COM RESTRIÇÃO":"SEM RESTRIÇÃO"}</span><strong>{lookupResult.name}</strong><p>{lookupResult.status==="Roubado"?"Atenção: este equipamento está cadastrado como roubado.":lookupResult.restriction_status==="Com restrição"?"Atenção: este equipamento tem uma restrição cadastrada na PROTEGE.":"Não existe uma restrição assinalada neste cadastro."}</p></>}
            </div>}
          </div>
        </section>
        <section className="landing-benefits" id="como-funciona">
          <article><span className="benefit-icon">⬡</span><div><strong>cadastro seguro</strong><p>Proteja os seus equipamentos</p></div></article>
          <article><span className="benefit-icon">⌕</span><div><strong>Consulta simples</strong><p>Verifique a situação de um equipamento</p></div></article>
          <article><span className="benefit-icon">♧</span><div><strong>Ajuda no combate ao crime</strong><p>Mais segurança para todos</p></div></article>
          <article><span className="benefit-icon">▣</span><div><strong>Os seus dados protegidos</strong><p>Com privacidade e acesso controlado</p></div></article>
        </section>
        <footer className="landing-footer" id="ajuda">PROTEGE · cadastro e proteção de equipamentos <span>A consulta pública não revela dados pessoais do proprietário.</span></footer>
      </main>
    );
  }

  return (
    <main className="page-shell auth-page">
      <button className="auth-home-link" type="button" onClick={()=>{setLandingMode(true);setNotice("");}}>← Voltar à página inicial</button>
      <section className="login-card">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.8 17.5-16 22C14.8 39.5 8 32 8 22V10L24 4Z"/><path d="m16 23 5 5 11-12"/></svg></div><div className="brand-name">PROTEGE</div><div className="brand-tagline">cadastro e proteção de equipamentos</div></div>
        <div className="form-heading"><h1>{copy[screen][0]}</h1><p>{copy[screen][1]}</p></div>
        <form onSubmit={submit} autoComplete="on">
          <label htmlFor="email">email</label><input id="email" name="username" type="email" autoComplete={screen === "login" ? "username" : "email"} placeholder="nome@exemplo.pt" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading}/>
          {screen !== "reset" && <><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete={screen === "register" ? "new-password" : "current-password"} placeholder="Digite a sua senha" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required disabled={loading}/></>}
          {screen === "login" && <div className="forgot-row"><button className="text-button" type="button" onClick={() => changeScreen("reset")} disabled={loading}>Esqueceu-se da senha?</button></div>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Aguarde..." : screen === "login" ? "Entrar" : screen === "register" ? "Criar conta" : "Enviar instruções"}</button>
          {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
        </form>
        {screen === "login" && <div className="oauth-divider"><span>ou</span></div>}
        {screen === "login" && <button className="google-signin-button" type="button" onClick={signInWithGoogle} disabled={loading}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.02 13.22l7.98 6.19C12.9 13.72 18.02 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.06 46.98 31.9 46.98 24.55Z"/><path fill="#FBBC05" d="M10.99 28.59A14.4 14.4 0 0 1 10.2 24c0-1.59.28-3.13.78-4.59L3 13.22A23.9 23.9 0 0 0 0 24c0 3.86.92 7.51 2.54 10.78l8.45-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.18 2.3-5.98 0-11.1-4.22-12.99-9.91L3.02 34.78C6.51 42.62 14.62 48 24 48Z"/></svg>Continuar com Google</button>}
        <div className="switch-screen">
          {screen === "login" ? <>Ainda não tem conta? <button className="text-button" type="button" onClick={() => changeScreen("register")} disabled={loading}>Criar conta</button></> :
           screen === "register" ? <>Já tem conta? <button className="text-button" type="button" onClick={() => changeScreen("login")} disabled={loading}>Entrar</button></> :
           <>Lembrou-se da senha? <button className="text-button" type="button" onClick={() => changeScreen("login")} disabled={loading}>Voltar a entrar</button></>}
        </div>
      </section>
      <footer>PROTEGE · cadastro e proteção de equipamentos</footer>
    </main>
  );
}