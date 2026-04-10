import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { UserPlus, Users as UsersIcon, Shield, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "viewer" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const roleLabel = (role) => role === "admin" ? "Administrador" : "Viewer";
  const RoleIcon = (role) => role === "admin" ? Shield : Eye;

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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => {
                const Icon = RoleIcon(u.role);
                return (
                  <tr key={u.id} className="odd:bg-card even:bg-muted/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          u.role === "admin" ? "bg-primary/20" : "bg-secondary"
                        )}>
                          <Icon className={cn("w-4 h-4", u.role === "admin" ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <p className="text-sm font-semibold text-white">{u.full_name || "—"}</p>
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
                    className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all",
                      form.role === "viewer" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}>
                    <Eye className="w-4 h-4" /> Viewer
                  </button>
                  <button type="button" onClick={() => set("role", "admin")}
                    className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all",
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
    </div>
  );
}
