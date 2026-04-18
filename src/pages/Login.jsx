import { useState } from "react";
import { LogIn, UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AdidasLogo from "@/components/AdidasLogo";

export default function Login({ onLogin, needsSetup }) {
  const [isSetup, setIsSetup] = useState(needsSetup);
  const [step, setStep] = useState("login"); // "login" | "2fa"
  const [tempToken, setTempToken] = useState("");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [twoFACode, setTwoFACode] = useState("");
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

      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setTwoFACode("");
        setStep("2fa");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      onLogin(data.user, data.token);
    } catch {
      setError("Error de conexión con el servidor");
    }
    setLoading(false);
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: twoFACode }),
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
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, hsl(46 100% 50%) 0, hsl(46 100% 50%) 1px, transparent 0, transparent 50%)`,
        backgroundSize: '48px 48px'
      }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5">
            <AdidasLogo size={80} />
          </div>
          <h1 className="text-2xl font-cabj text-gold-gradient tracking-wider">CONTROL DE STOCK</h1>
          <p className="text-muted-foreground text-sm font-industry mt-1 tracking-wide">INDUMENTARIA DISCONTINUADA</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-lg boca-card-glow p-7">
          {step === "login" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-industry font-semibold text-foreground">Verificacion 2FA</h2>
              </div>
              <p className="text-sm text-muted-foreground font-industry mb-5">
                Ingresa el codigo de 6 digitos de tu app de autenticacion.
              </p>
              <form onSubmit={handle2FA} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-industry uppercase tracking-wider text-muted-foreground">Codigo</Label>
                  <Input
                    value={twoFACode}
                    onChange={e => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-12 text-center text-2xl tracking-widest font-mono"
                    autoFocus
                    inputMode="numeric"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full gap-2 h-11 font-industry font-semibold text-sm uppercase tracking-wider" disabled={loading || twoFACode.length !== 6}>
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Shield className="w-4 h-4" /> Verificar</>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("login"); setError(""); }}
                  className="w-full text-xs text-muted-foreground font-industry hover:text-foreground transition-colors"
                >
                  Volver al login
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-muted-foreground/40 text-xs mt-6 font-industry">
          Club Atletico Boca Juniors &middot; Departamento de Indumentaria
        </p>
      </div>
    </div>
  );
}
