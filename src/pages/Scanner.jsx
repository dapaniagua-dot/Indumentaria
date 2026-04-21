import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ScanLine, ArrowUpCircle, ArrowDownCircle, CheckCircle, XCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Scanner() {
  const [mode, setMode] = useState("entrada"); // entrada | salida
  const [scannedCode, setScannedCode] = useState("");
  const [buffer, setBuffer] = useState("");
  const [lastResult, setLastResult] = useState(null); // { product, type, qty, success }
  const [recentScans, setRecentScans] = useState([]);
  const [qty, setQty] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [pendingVariant, setPendingVariant] = useState(null); // { product, quantity } when waiting for con/sin pub choice
  const inputRef = useRef(null);

  // Keep input focused for scanner
  useEffect(() => {
    const focus = () => { inputRef.current?.focus(); };
    focus();
    document.addEventListener("click", focus);
    return () => document.removeEventListener("click", focus);
  }, []);

  const applyMovement = async (product, quantity, hasPublicidad) => {
    const sinPub = product.stock_sin_pub || 0;
    const conPub = product.stock_con_pub || 0;
    const delta = mode === "entrada" ? quantity : -quantity;

    let newSinPub = sinPub, newConPub = conPub, newStock = product.stock || 0;
    if (product.tiene_variante_publicidad) {
      if (hasPublicidad) newConPub = Math.max(0, conPub + delta);
      else newSinPub = Math.max(0, sinPub + delta);
      newStock = newSinPub + newConPub;
    } else {
      newStock = Math.max(0, (product.stock || 0) + delta);
    }

    await base44.entities.Product.update(product.id, {
      stock: newStock,
      stock_sin_pub: newSinPub,
      stock_con_pub: newConPub,
    });
    await base44.entities.StockMovement.create({
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      type: mode,
      quantity,
      notes: product.tiene_variante_publicidad ? `Escáner USB · ${hasPublicidad ? "Con" : "Sin"} publicidad` : `Escáner USB`,
      has_publicidad: product.tiene_variante_publicidad ? hasPublicidad : null,
    });

    const result = { success: true, product, type: mode, qty: quantity, newStock, hasPublicidad };
    setLastResult(result);
    setRecentScans(prev => [result, ...prev.slice(0, 9)]);
  };

  const processCode = async (code) => {
    if (!code.trim() || processing) return;
    setProcessing(true);
    setScannedCode(code);

    const products = await base44.entities.Product.filter({ sku: code });
    const product = products[0];

    if (!product) {
      setLastResult({ success: false, code, message: `SKU "${code}" no encontrado` });
      setProcessing(false);
      return;
    }

    const quantity = Number(qty);
    if (product.tiene_variante_publicidad) {
      setPendingVariant({ product, quantity });
      setProcessing(false);
      return;
    }

    await applyMovement(product, quantity, null);
    setProcessing(false);
  };

  const handleVariantChoice = async (hasPublicidad) => {
    if (!pendingVariant) return;
    setProcessing(true);
    const { product, quantity } = pendingVariant;
    setPendingVariant(null);
    await applyMovement(product, quantity, hasPublicidad);
    setProcessing(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const val = e.target.value.trim();
      if (val) {
        processCode(val);
        e.target.value = "";
      }
    }
  };

  const handleManual = () => {
    if (scannedCode.trim()) processCode(scannedCode.trim());
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Escáner</h1>
        <p className="text-muted-foreground text-sm mt-1">Conecta tu lector USB y escanea los códigos</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3">
        <button onClick={() => setMode("entrada")}
          className={cn("flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-semibold text-sm transition-all",
            mode === "entrada"
              ? "border-green-500 bg-green-50 text-green-700"
              : "border-border bg-card text-muted-foreground hover:border-green-300"
          )}>
          <ArrowUpCircle className="w-5 h-5" /> ENTRADA de Stock
        </button>
        <button onClick={() => setMode("salida")}
          className={cn("flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-semibold text-sm transition-all",
            mode === "salida"
              ? "border-red-500 bg-red-50 text-red-700"
              : "border-border bg-card text-muted-foreground hover:border-red-300"
          )}>
          <ArrowDownCircle className="w-5 h-5" /> SALIDA de Stock
        </button>
      </div>

      {/* Scanner input area */}
      <div className={cn("rounded-2xl border-2 p-6 text-center transition-all",
        mode === "entrada" ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
      )}>
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
          mode === "entrada" ? "bg-green-100" : "bg-red-100"
        )}>
          <ScanLine className={cn("w-8 h-8", mode === "entrada" ? "text-green-600" : "text-red-600")} />
        </div>
        <p className="font-semibold text-foreground mb-1">
          {mode === "entrada" ? "📦 Modo ENTRADA" : "🚚 Modo SALIDA"}
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          Apunta el lector al código o ingresa el SKU manualmente
        </p>

        <div className="flex gap-3 max-w-md mx-auto">
          <div className="w-24">
            <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
              className="text-center font-bold text-lg h-12" placeholder="Qty" />
          </div>
          <Input
            ref={inputRef}
            placeholder="Escanear o escribir SKU + Enter"
            className="flex-1 h-12 font-mono"
            onKeyDown={handleKeyDown}
            onChange={e => setScannedCode(e.target.value)}
          />
          <Button onClick={handleManual} className="h-12 px-6" disabled={processing}>
            {processing ? "..." : "OK"}
          </Button>
        </div>
      </div>

      {/* Variant prompt modal */}
      {pendingVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">¿Tiene publicidad?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>{pendingVariant.product.name}</strong> · SKU {pendingVariant.product.sku}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Sin pub: {pendingVariant.product.stock_sin_pub || 0} · Con pub: {pendingVariant.product.stock_con_pub || 0}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVariantChoice(false)}
                disabled={processing}
                className="py-4 rounded-xl border-2 border-border bg-card hover:border-primary font-semibold text-sm transition-all"
              >
                Sin publicidad
              </button>
              <button
                onClick={() => handleVariantChoice(true)}
                disabled={processing}
                className="py-4 rounded-xl border-2 border-primary bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-all"
              >
                Con publicidad
              </button>
            </div>
            <button
              onClick={() => setPendingVariant(null)}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Last result */}
      {lastResult && (
        <div className={cn("rounded-2xl border p-5 flex items-center gap-4",
          lastResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        )}>
          {lastResult.success
            ? <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            : <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />}
          <div className="flex-1">
            {lastResult.success ? (
              <>
                <p className="font-bold text-foreground">{lastResult.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {lastResult.type === "entrada" ? `+${lastResult.qty}` : `-${lastResult.qty}`} unidades · Stock actual: <strong>{lastResult.newStock}</strong>
                </p>
              </>
            ) : (
              <p className="font-semibold text-red-700">{lastResult.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Recent scans list */}
      {recentScans.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Escaneos de esta sesión</h2>
          </div>
          <div className="divide-y divide-border">
            {recentScans.map((r, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center",
                    r.type === "entrada" ? "bg-green-100" : "bg-red-100"
                  )}>
                    <Package className={cn("w-3.5 h-3.5", r.type === "entrada" ? "text-green-600" : "text-red-600")} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.product.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn("text-sm font-bold", r.type === "entrada" ? "text-green-600" : "text-red-600")}>
                    {r.type === "entrada" ? "+" : "-"}{r.qty}
                  </span>
                  <p className="text-xs text-muted-foreground">Stock: {r.newStock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}