import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { UserPlus, Shield, Eye, KeyRound, Power, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function Users() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "viewer" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [resetting, setResetting] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/auth/users", { headers });
      if (res.ok) setUsers(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
      setShowForm(false);
      setForm({ email: "", password: "", full_name: "", role: "viewer" });
      loadUsers();
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  };

  const changeRole = async (u, newRole) => {
    if (!newRole || newRole === u.role) return;
    if (!window.confirm(`¿Cambiar el rol de ${u.full_name || u.email} a ${roleLabel(newRole)}?`)) return;
    setBusyId(u.id); setActionError("");
    try {
      const res = await fetch(`/api/auth/users/${u.id}/role`, { method: "PUT", headers, body: JSON.stringify({ role: newRole }) });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || "Error al cambiar el rol");
      else await loadUsers();
    } catch { setActionError("Error de conexión"); }
    setBusyId(null);
  };

  const toggleActive = async (u) => {
    const next = !u.active;
    if (!window.confirm(`¿${next ? "Activar" : "Desactivar"} a ${u.full_name || u.email}?`)) return;
    setBusyId(u.id); setActionError("");
    try {
      const res = await fetch(`/api/auth/users/${u.id}/active`, { method: "PUT", headers, body: JSON.stringify({ active: next }) });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || "Error al cambiar el estado");
      else await loadUsers();
    } catch { setActionError("Error de conexión"); }
    setBusyId(null);
  };

  const openReset = (u) => { setResetTarget(u); setNewPass(""); setNewPass2(""); setActionError(""); };

  const doReset = async (e) => {
    e.preventDefault();
    setActionError("");
    if (newPass.length < 6) { setActionError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPass !== newPass2) { setActionError("Las contraseñas no coinciden"); return; }
    setResetting(true);
    try {
      const res = await fetch(`/api/auth/users/${resetTarget.id}/reset-password`, { method: "POST", headers, body: JSON.stringify({ password: newPass }) });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Error al resetear"); setResetting(false); return; }
      const name = resetTarget.full_name || resetTarget.email;
      setResetTarget(null);
      alert(`Contraseña actualizada para ${name}.`);
    } catch { setActionError("Error de conexión"); }
    setResetting(false);
  };

  const roleLabel = (role) => role === "admin" ? "Administrador" : role === "carga" ? "Cargador" : "Viewer";
  const RoleIcon = (role) => role === "admin" ? Shield : role === "carga" ? PackagePlus : Eye;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} usuarios registrados</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Nuevo Usuario
        </Button>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuario</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => {
                const Icon = RoleIcon(u.role);
                const isSelf = currentUser?.id === u.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="odd:bg-card even:bg-muted/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          u.role === "admin" ? "bg-primary/20" : "bg-secondary"
                        )}>
                          <Icon className={cn("w-4 h-4", u.role === "admin" ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <p className="text-sm font-semibold text-white">{u.full_name || "—"}{isSelf && <span className="text-xs text-muted-foreground font-normal"> (vos)</span>}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={cn("text-xs font-medium px-3 py-1 rounded-full",
                        u.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                      )}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("text-xs font-medium px-3 py-1 rounded-full",
                        u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <select
                          value={u.role}
                          disabled={busy || isSelf}
                          onChange={(e) => changeRole(u, e.target.value)}
                          title={isSelf ? "No podés cambiar tu propio rol" : "Cambiar rol"}
                          className="bg-background border border-border rounded-lg text-xs px-2 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="carga">Cargador</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => openReset(u)}
                          disabled={busy}
                          title="Resetear contraseña"
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={busy || isSelf}
                          title={isSelf ? "No podés desactivar tu cuenta" : (u.active ? "Desactivar" : "Activar")}
                          className={cn("p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed",
                            u.active ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-green-600")}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Crear Usuario</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Nombre completo</Label>
                <Input value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Nombre y apellido" required />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@ejemplo.com" required />
              </div>
              <div className="space-y-1">
                <Label>Contraseña</Label>
                <Input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => set("role", "viewer")}
                    className={cn("flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl text-xs font-medium border transition-all",
                      form.role === "viewer" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}>
                    <Eye className="w-4 h-4" /> Viewer
                  </button>
                  <button type="button" onClick={() => set("role", "carga")}
                    className={cn("flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl text-xs font-medium border transition-all",
                      form.role === "carga" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}>
                    <PackagePlus className="w-4 h-4" /> Cargador
                  </button>
                  <button type="button" onClick={() => set("role", "admin")}
                    className={cn("flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl text-xs font-medium border transition-all",
                      form.role === "admin" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}>
                    <Shield className="w-4 h-4" /> Admin
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 gap-2" disabled={saving}>
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" /> Crear</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResetTarget(null)}>
          <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Resetear contraseña</h2>
            <p className="text-sm text-muted-foreground mb-4">{resetTarget.full_name || resetTarget.email}</p>
            <form onSubmit={doReset} className="space-y-4">
              <div className="space-y-1">
                <Label>Nueva contraseña</Label>
                <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus minLength={6} />
              </div>
              <div className="space-y-1">
                <Label>Repetir contraseña</Label>
                <Input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="Repetir" minLength={6} />
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{actionError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setResetTarget(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 gap-2" disabled={resetting}>
                  {resetting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><KeyRound className="w-4 h-4" /> Guardar</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
