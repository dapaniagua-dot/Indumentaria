import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Scan, Check, Trash2, Package, Video, VideoOff, Camera, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateEntregaPDF } from "@/lib/entregaPdf";
import { useEntregaRecorder } from "@/hooks/useEntregaRecorder";

const CLOSING_SECONDS = 30; // segundos extra que se graban tras confirmar la entrega

export default function Entregas() {
  const { user } = useAuth();
  const [form, setForm] = useState({ nombre: "", apellido: "", dni: "", sector: "" });
  const [items, setItems] = useState([]);
  const [scanInput, setScanInput] = useState("");
  const [listConfirmed, setListConfirmed] = useState(false);
  const [scanError, setScanError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedVideoUrl, setSavedVideoUrl] = useState("");
  const scanRef = useRef(null);

  // --- Video recording ---
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [started, setStarted] = useState(false);     // operador tocó "Comenzar entrega"
  const [noVideo, setNoVideo] = useState(false);      // continuar sin grabación (cámara falló)
  const [starting, setStarting] = useState(false);
  const [videoStage, setVideoStage] = useState("");   // ''|closing|stopping|uploading|done|error
  const [uploadPct, setUploadPct] = useState(0);
  const [closingCountdown, setClosingCountdown] = useState(CLOSING_SECONDS);
  const overlayRef = useRef({ nombre: "", apellido: "", dni: "", count: 0 });
  const recorder = useEntregaRecorder({ enabled: videoEnabled, overlayRef });

  const now = new Date();
  const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const hora = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const totalPrendas = items.reduce((s, i) => s + i.quantity, 0);
  const showGate = videoEnabled && !noVideo && !started;
  const showCard = videoEnabled && !noVideo && !done;

  // keep overlay text fresh for the canvas render loop
  useEffect(() => {
    overlayRef.current = { nombre: form.nombre, apellido: form.apellido, dni: form.dni, count: totalPrendas };
  });

  useEffect(() => {
    if (started && !listConfirmed && !done && scanRef.current) scanRef.current.focus();
  });

  // detect feature + auto-start camera (preview en el gate)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await base44.videoEntregas.isEnabled();
      if (cancelled) return;
      setVideoEnabled(enabled);
      if (enabled) recorder.startCamera();
    })();
    return () => { cancelled = true; };
  }, []);

  const processCode = async (code) => {
    setScanError("");
    const results = await base44.entities.Product.filter({ sku: code });
    if (!results.length) {
      setScanError(`No se encontró producto con SKU: ${code}`);
      return;
    }
    const p = results[0];
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) {
        return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        size: p.size,
        color: p.color,
        category: p.category,
        quantity: 1
      }];
    });
  };

  const handleScan = async (e) => {
    if (e.key === "Enter" && scanInput.trim()) {
      await processCode(scanInput.trim());
      setScanInput("");
    }
  };

  // --- Gate: comenzar la entrega y la grabación ---
  const handleStart = async () => {
    setStarting(true);
    let ok = recorder.state === "ready" || recorder.state === "recording";
    if (!ok) ok = await recorder.startCamera();
    if (ok) {
      recorder.startRecording();
      setStarted(true);
    }
    setStarting(false);
  };

  const handleContinueSinVideo = () => {
    setNoVideo(true);
    setStarted(true);
  };

  const runClosingCountdown = (secs) => new Promise((resolve) => {
    setClosingCountdown(secs);
    const iv = setInterval(() => {
      setClosingCountdown((prev) => {
        if (prev <= 1) { clearInterval(iv); resolve(); return 0; }
        return prev - 1;
      });
    }, 1000);
  });

  const handleConfirmEntrega = async () => {
    if (!window.confirm(`Se van a descontar ${totalPrendas} prenda(s) del stock general. ¿Confirmar entrega?`)) return;
    setSaving(true);

    try {
      // 1) Cierre de 30s + finalizar + subir el video
      let video_url = "";
      const recording = videoEnabled && !noVideo && recorder.isRecording;
      if (recording) {
        setVideoStage("closing");
        await runClosingCountdown(CLOSING_SECONDS);
        setVideoStage("stopping");
        const result = await recorder.stopRecording();
        if (result?.blob && result.blob.size > 0) {
          try {
            setVideoStage("uploading");
            setUploadPct(0);
            const { uploadUrl, publicUrl, contentType } = await base44.videoEntregas.presign(result.mimeType);
            await base44.videoEntregas.upload(uploadUrl, result.blob, contentType, (p) => setUploadPct(Math.round(p * 100)));
            video_url = publicUrl;
            setVideoStage("done");
          } catch {
            setVideoStage("error");
            if (!window.confirm("No se pudo subir el video de la entrega. ¿Guardar la entrega SIN video?")) {
              setSaving(false);
              return;
            }
          }
        }
      }

      // 2) Hora confiable del servidor (sello del registro)
      let fechaHoraStr;
      try {
        const t = await base44.videoEntregas.serverTime();
        fechaHoraStr = new Date(t.now).toLocaleString("es-AR");
      } catch {
        fechaHoraStr = new Date().toLocaleString("es-AR");
      }

      // 3) Descontar stock y registrar movimientos
      for (const item of items) {
        const fresh = await base44.entities.Product.filter({ sku: item.sku });
        if (fresh.length) {
          const p = fresh[0];
          await base44.entities.Product.update(p.id, { stock: Math.max(0, (p.stock || 0) - item.quantity) });
          await base44.entities.StockMovement.create({
            product_id: p.id,
            product_name: p.name,
            product_sku: p.sku,
            type: "salida",
            quantity: item.quantity,
            notes: `Entrega a ${form.nombre} ${form.apellido} — Sector: ${form.sector}`,
            user_email: user?.email,
            reference: "entrega"
          });
        }
      }

      // 4) Crear la entrega
      const entregaData = {
        fecha_hora: fechaHoraStr,
        receptor_nombre: form.nombre,
        receptor_apellido: form.apellido,
        receptor_dni: form.dni,
        sector: form.sector,
        prendas: items,
        total_prendas: totalPrendas,
        entregado_por_email: user?.email,
        entregado_por_nombre: user?.full_name,
        video_url
      };

      await base44.entities.Entrega.create(entregaData);
      const doc = generateEntregaPDF(entregaData);
      doc.save(`entrega-${form.apellido}-${Date.now()}.pdf`);

      recorder.cleanup();
      setSavedVideoUrl(video_url);
      setSaving(false);
      setDone(true);
    } catch (err) {
      setSaving(false);
      setVideoStage("");
      alert("Ocurrió un error al confirmar la entrega: " + (err?.message || ""));
    }
  };

  const resetForm = () => {
    setDone(false);
    setForm({ nombre: "", apellido: "", dni: "", sector: "" });
    setItems([]);
    setListConfirmed(false);
    setScanInput("");
    setScanError("");
    setSavedVideoUrl("");
    setVideoStage("");
    setUploadPct(0);
    setClosingCountdown(CLOSING_SECONDS);
    setStarted(false);
    setNoVideo(false);
    if (videoEnabled) recorder.startCamera();
  };

  if (done) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">¡Entrega confirmada!</h2>
        <p className="text-muted-foreground text-sm">El PDF fue generado y el stock fue actualizado.</p>
        {videoEnabled && !noVideo && (
          savedVideoUrl ? (
            <p className="text-green-500 text-sm flex items-center gap-1.5"><Video className="w-4 h-4" /> Video de la entrega guardado</p>
          ) : (
            <p className="text-amber-500 text-sm flex items-center gap-1.5"><VideoOff className="w-4 h-4" /> Entrega guardada sin video</p>
          )
        )}
        <Button onClick={resetForm}>Nueva entrega</Button>
      </div>
    );
  }

  const recStatusLabel = {
    starting: "Iniciando cámara…",
    ready: "Cámara lista",
    recording: "Grabando",
    denied: "Cámara bloqueada",
    error: "Error de cámara",
    idle: "Cámara apagada",
  }[recorder.state] || "";

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-primary uppercase">FORMULARIO DE ENTREGA DE INDUMENTARIA</h1>
      </div>

      {/* Tarjeta de grabación (persistente: gate + formulario) */}
      {showCard && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-white uppercase tracking-wide flex items-center gap-2">
              <Video className="w-4 h-4" /> Grabación de la entrega
            </h2>
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${
              recorder.state === "recording" ? "text-red-500" :
              recorder.state === "ready" ? "text-green-500" :
              recorder.state === "denied" || recorder.state === "error" ? "text-amber-500" :
              "text-muted-foreground"
            }`}>
              {recorder.state === "recording" && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              {recorder.state === "starting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {recStatusLabel}{recorder.state === "recording" ? ` · ${Math.floor(recorder.elapsed/60)}:${String(recorder.elapsed%60).padStart(2,'0')}` : ""}
            </span>
          </div>

          {/* Hidden source video + visible canvas with burned-in overlay */}
          <video ref={recorder.videoRef} className="hidden" playsInline muted />
          <div className="relative rounded-xl overflow-hidden bg-black">
            <canvas ref={recorder.canvasRef} className="w-full max-h-[42vh] object-contain block" />
            {(recorder.state === "denied" || recorder.state === "error" || recorder.state === "idle") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-center px-4">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <p className="text-sm text-white/90">{recorder.errorMsg || "La cámara no está activa."}</p>
                <Button size="sm" variant="secondary" onClick={() => recorder.startCamera()} className="gap-2">
                  <Camera className="w-4 h-4" /> Reintentar cámara
                </Button>
              </div>
            )}
          </div>

          {/* Selector de cámara (solo antes de grabar) */}
          {!recorder.isRecording && recorder.devices.length > 1 && (
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <select
                value={recorder.deviceId}
                onChange={(e) => { recorder.setDeviceId(e.target.value); recorder.startCamera(e.target.value); }}
                className="bg-background border border-border rounded-lg text-sm px-2 py-1.5 max-w-[260px]"
              >
                {recorder.devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {showGate ? (
        /* Pantalla de inicio */
        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">Entrega de indumentaria con registro en video</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Estás por iniciar una entrega de indumentaria. Para un mayor control y respaldo,
              la entrega se registrará en <strong className="text-foreground">video con audio</strong>, desde el inicio hasta su
              finalización. El video queda asociado a esta entrega como comprobante.
            </p>
          </div>
          <Button size="lg" onClick={handleStart} disabled={starting || recorder.state === "starting"} className="gap-2">
            {(starting || recorder.state === "starting")
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando…</>
              : <><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Comenzar entrega y grabación</>}
          </Button>
          {(recorder.state === "denied" || recorder.state === "error") && (
            <div className="space-y-2">
              <p className="text-xs text-amber-500">{recorder.errorMsg || "No se pudo acceder a la cámara."}</p>
              <button onClick={handleContinueSinVideo} className="text-xs text-muted-foreground underline hover:text-foreground">
                Continuar sin grabación
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Al comenzar se activa la grabación. Asegurate de tener la mercadería y el receptor a la vista.
          </p>
        </div>
      ) : (
        <>
          {videoEnabled && noVideo && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 flex items-center gap-2">
              <VideoOff className="w-4 h-4" /> Esta entrega se está registrando <strong>sin video</strong>.
            </div>
          )}

          {/* Fecha/hora */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <p className="text-xs text-white uppercase tracking-wide mb-1">Fecha y hora de entrega</p>
            <p className="text-foreground font-semibold">{fecha}&nbsp;&nbsp;&nbsp;{hora}</p>
          </div>

          {/* Datos receptor */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="text-xs text-white uppercase tracking-wide">Datos del receptor</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
              </div>
              <div className="space-y-1">
                <Label>Apellido *</Label>
                <Input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} placeholder="Apellido" />
              </div>
              <div className="space-y-1">
                <Label>DNI</Label>
                <Input value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} placeholder="00.000.000" />
              </div>
              <div className="space-y-1">
                <Label>Sector que recibe</Label>
                <Input value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} placeholder="Ej: Básquet, Hockey..." />
              </div>
            </div>
          </div>

          {/* Prendas */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="text-xs text-white uppercase tracking-wide">Prendas entregadas</h2>

            {!listConfirmed && (
              <div className="space-y-2">
                <Label>Escanear código de barras</Label>
                <div className="relative">
                  <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={scanRef}
                    className="pl-9"
                    placeholder="Escanear o ingresar SKU y presionar Enter..."
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={handleScan}
                  />
                </div>
                {scanError && <p className="text-xs text-destructive">{scanError}</p>}
              </div>
            )}

            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={item.product_id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku} · {item.size || "-"} · {item.color || "-"}</p>
                    </div>
                    <span className="text-sm font-bold text-primary">×{item.quantity}</span>
                    {!listConfirmed && (
                      <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <span className="text-sm font-semibold">Total: {totalPrendas} prenda(s)</span>
                  {!listConfirmed ? (
                    <Button size="sm" onClick={() => setListConfirmed(true)}>
                      <Check className="w-4 h-4 mr-1" /> Confirmar listado
                    </Button>
                  ) : (
                    <span className="text-xs text-green-500 font-semibold">✓ Listado confirmado</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Sin prendas escaneadas aún</p>
            )}
          </div>

          {/* Entregado por */}
          {listConfirmed && (
            <div className="bg-card rounded-2xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Entrega realizada por el usuario:</p>
              <p className="text-foreground font-semibold">{user?.full_name}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
          )}

          {/* Botón confirmar */}
          {listConfirmed && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirmEntrega}
              disabled={saving || !form.nombre || !form.apellido || items.length === 0}
            >
              {saving ? "Procesando…" : "Confirmar Entrega"}
            </Button>
          )}
        </>
      )}

      {/* Overlay de finalización (cierre 30s + subida) */}
      {saving && (videoStage === "closing" || videoStage === "stopping" || videoStage === "uploading") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full text-center space-y-4">
            {videoStage === "closing" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-red-500/15 flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Grabando cierre de la entrega</h3>
                <p className="text-5xl font-bold text-primary tabular-nums">{closingCountdown}s</p>
                <p className="text-sm text-muted-foreground">Mantené la cámara enfocada en la entrega y el receptor.</p>
              </>
            )}
            {videoStage === "stopping" && (
              <>
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                <h3 className="font-bold text-lg text-foreground">Finalizando video…</h3>
              </>
            )}
            {videoStage === "uploading" && (
              <>
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                <h3 className="font-bold text-lg text-foreground">Subiendo video…</h3>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">{uploadPct}%</p>
              </>
            )}
            <p className="text-[11px] text-muted-foreground">No cierres esta ventana.</p>
          </div>
        </div>
      )}
    </div>
  );
}
