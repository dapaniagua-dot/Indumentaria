import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Scan, Check, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateEntregaPDF } from "@/lib/entregaPdf";

export default function Entregas() {
  const { user } = useAuth();
  const [form, setForm] = useState({ nombre: "", apellido: "", dni: "", sector: "" });
  const [items, setItems] = useState([]);
  const [scanInput, setScanInput] = useState("");
  const [listConfirmed, setListConfirmed] = useState(false);
  const [scanError, setScanError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const scanRef = useRef(null);

  const now = new Date();
  const fecha = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  const hora = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const fechaHora = `${fecha}   ${hora}`;

  useEffect(() => {
    if (!listConfirmed && scanRef.current) {
      scanRef.current.focus();
    }
  });

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

  const totalPrendas = items.reduce((s, i) => s + i.quantity, 0);

  const handleConfirmEntrega = async () => {
    if (!window.confirm(`Se van a descontar ${totalPrendas} prenda(s) del stock general. ¿Confirmar entrega?`)) return;
    setSaving(true);

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

    const entregaData = {
      fecha_hora: new Date().toLocaleString("es-AR"),
      receptor_nombre: form.nombre,
      receptor_apellido: form.apellido,
      receptor_dni: form.dni,
      sector: form.sector,
      prendas: items,
      total_prendas: totalPrendas,
      entregado_por_email: user?.email,
      entregado_por_nombre: user?.full_name
    };

    await base44.entities.Entrega.create(entregaData);
    const doc = generateEntregaPDF(entregaData);
    doc.save(`entrega-${form.apellido}-${Date.now()}.pdf`);

    setSaving(false);
    setDone(true);
  };

  const resetForm = () => {
    setDone(false);
    setForm({ nombre: "", apellido: "", dni: "", sector: "" });
    setItems([]);
    setListConfirmed(false);
    setScanInput("");
    setScanError("");
  };

  if (done) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">¡Entrega confirmada!</h2>
        <p className="text-muted-foreground text-sm">El PDF fue generado y el stock fue actualizado.</p>
        <Button onClick={resetForm}>Nueva entrega</Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-primary uppercase">FORMULARIO DE ENTREGA DE INDUMENTARIA</h1>
      </div>

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
          {saving ? "Procesando..." : "Confirmar Entrega"}
        </Button>
      )}
    </div>
  );
}