import { useState, useEffect } from "react";
import { Shield, ShieldOff, ShieldCheck, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import QRCode from "qrcode";

export default function TwoFactorModal({ onClose }) {
  const { token } = useAuth();
  const [step, setStep] = useState("loading");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch("/api/auth/2fa/status", { headers })
      .then(r => r.json())
      .then(data => {
        setIs2FAEnabled(data.enabled);
        setStep("status");
      })
      .catch(() => setStep("status"));
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST", headers });
      const data = await res.json();
      const qr = await QRCode.toDataURL(data.otpauth_url, { width: 200, margin: 2, color: { dark: "#000", light: "#fff" } });
      setQrDataUrl(qr);
      setSecret(data.secret);
      setCode("");
      setStep("setup-qr");
    } catch {
      setError("Error al generar el código QR");
    }
    setLoading(false);
  };

  const handleEnable = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST", headers,
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setIs2FAEnabled(true);
      setStep("success");
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  const handleDisable = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST", headers,
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setIs2FAEnabled(false);
      setStep("status");
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-base font-industry font-semibold text-foreground">Autenticacion 2 Factores</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "loading" && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {step === "status" && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${is2FAEnabled ? "border-green-500/30 bg-green-500/10" : "border-border bg-muted/30"}`}>
              {is2FAEnabled
                ? <ShieldCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
                : <ShieldOff className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              }
              <div>
                <p className="text-sm font-industry font-semibold text-foreground">
                  {is2FAEnabled ? "2FA Activo" : "2FA Desactivado"}
                </p>
                <p className="text-xs text-muted-foreground font-industry">
                  {is2FAEnabled ? "Tu cuenta esta protegida" : "Solo usas contrasena"}
                </p>
              </div>
            </div>

            {is2FAEnabled ? (
              <Button
                variant="destructive"
                className="w-full gap-2 font-industry"
                onClick={() => { setCode(""); setError(""); setStep("disable"); }}
              >
                <ShieldOff className="w-4 h-4" /> Desactivar 2FA
              </Button>
            ) : (
              <Button className="w-full gap-2 font-industry" onClick={handleSetup} disabled={loading}>
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Shield className="w-4 h-4" /> Activar 2FA</>
                }
              </Button>
            )}
          </div>
        )}

        {step === "setup-qr" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-industry">
              Escaneá este QR con <strong className="text-foreground">Google Authenticator</strong> o <strong className="text-foreground">Authy</strong>.
            </p>
            {qrDataUrl && (
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <img src={qrDataUrl} alt="QR 2FA" className="w-44 h-44" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-industry mb-1">Clave manual (si no podés escanear):</p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs bg-muted p-2 rounded-lg text-foreground font-mono break-all">{secret}</code>
                <button onClick={copySecret} className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full font-industry" onClick={() => { setCode(""); setError(""); setStep("setup-verify"); }}>
              Ya lo escaneé, continuar
            </Button>
          </div>
        )}

        {step === "setup-verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-industry">
              Ingresá el código de 6 dígitos de la app para confirmar.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-industry uppercase tracking-wider text-muted-foreground">Codigo</Label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest h-12 font-mono"
                autoFocus
                inputMode="numeric"
              />
            </div>
            {error && <p className="text-sm text-destructive font-industry">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 font-industry" onClick={() => setStep("setup-qr")}>Atras</Button>
              <Button className="flex-1 font-industry" onClick={handleEnable} disabled={loading || code.length !== 6}>
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Activar"}
              </Button>
            </div>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-industry">
              Ingresá el código de la app para desactivar 2FA.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-industry uppercase tracking-wider text-muted-foreground">Codigo</Label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest h-12 font-mono"
                autoFocus
                inputMode="numeric"
              />
            </div>
            {error && <p className="text-sm text-destructive font-industry">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 font-industry" onClick={() => setStep("status")}>Cancelar</Button>
              <Button variant="destructive" className="flex-1 font-industry" onClick={handleDisable} disabled={loading || code.length !== 6}>
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Desactivar"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="font-industry font-semibold text-foreground">2FA Activado</p>
              <p className="text-sm text-muted-foreground font-industry mt-1">Tu cuenta ahora está protegida con doble factor.</p>
            </div>
            <Button className="w-full font-industry" onClick={onClose}>Listo</Button>
          </div>
        )}
      </div>
    </div>
  );
}
