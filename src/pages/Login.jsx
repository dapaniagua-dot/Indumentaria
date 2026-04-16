import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AdidasLogo from "@/components/AdidasLogo";

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
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, role: "admin" }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setLoading(false); return; }
        setIsSetup(false);
        setError("");
      }

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, hsl(46 100% 50%) 0, hsl(46 100% 50%) 1px, transparent 0, transparent 50%)`,
        backgroundSize: '48px 48px'
      }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5">
            <AdidasLogo size={80} />
          </div>
          <h1 className="text-2xl font-cabj text-gold-gradient tracking-wider">CONTROL DE STOCK</h1>
          <p className="text-muted-foreground text-sm font-industry mt-1 tracking-wide">INDUMENTARIA DISCONTINUADA</p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-2xl border border-border shadow-lg boca-card-glow p-7">
          <h2 className="text-lg font-industry font-semibold mb-5 text-foreground">
            {isSetup ? "Crear cuenta de administrador" : "Iniciar sesion"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSetup && (
              <div className="space-y-1.5">
                <Label className="text-xs font-industry uppercase tracking-wider text-muted-foreground">Nombre completo</Label>
                <Input
                  value={form.full_name}
                  onChange={e => set("full_name", e.target.value)}
                  placeholder="Ej: Diego Paniagua"
                  required
                  className="h-11"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-industry uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="email@ejemplo.com"
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-industry uppercase tracking-wider text-muted-foreground">Contrasena</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder={isSetup ? "Minimo 6 caracteres" : "Tu contrasena"}
                required
                minLength={isSetup ? 6 : 1}
                autoComplete={isSetup ? "new-password" : "current-password"}
                className="h-11"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full gap-2 h-11 font-industry font-semibold text-sm uppercase tracking-wider" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSetup ? (
                <><UserPlus className="w-4 h-4" /> Crear cuenta y entrar</>
              ) : (
                <><LogIn className="w-4 h-4" /> Iniciar sesion</>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground/40 text-xs mt-6 font-industry">
          Club Atletico Boca Juniors &middot; Departamento de Indumentaria
        </p>
      </div>
    </div>
  );
}
