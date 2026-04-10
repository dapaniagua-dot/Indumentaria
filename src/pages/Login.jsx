import { useState } from "react";
import { Layers, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login({ onLogin, needsSetup }) {
  const [isSetup, setIsSetup] = useState(needsSetup);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSetup) {
        // Register first admin
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, role: "admin" }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setLoading(false); return; }
        setIsSetup(false);
        setError("");
        // After setup, login automatically
      }

      // Login
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      localStorage.setItem("token", data.token);
      onLogin(data.user, data.token);
    } catch {
      setError("Error de conexión con el servidor");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Control de Stock</h1>
          <p className="text-muted-foreground text-sm">Indumentaria Discontinuada</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isSetup ? "Crear cuenta de administrador" : "Iniciar sesión"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSetup && (
              <div className="space-y-1">
                <Label>Nombre completo</Label>
                <Input
                  value={form.full_name}
                  onChange={e => set("full_name", e.target.value)}
                  placeholder="Ej: Diego Paniagua"
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="email@ejemplo.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder={isSetup ? "Mínimo 6 caracteres" : "Tu contraseña"}
                required
                minLength={isSetup ? 6 : 1}
                autoComplete={isSetup ? "new-password" : "current-password"}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSetup ? (
                <><UserPlus className="w-4 h-4" /> Crear cuenta y entrar</>
              ) : (
                <><LogIn className="w-4 h-4" /> Iniciar sesión</>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
