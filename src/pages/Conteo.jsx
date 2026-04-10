import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ScanLine, Trash2, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Conteo() {
  const [items, setItems] = useState({});
  const [notFound, setNotFound] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  // Capturar teclado globalmente - el lector escribe aunque el campo no tenga foco
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (input.trim()) processCode(input);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, [input]);

  const processCode = async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setInput("");
    setNotFound(null);

    // Buscar producto por SKU (EAN)
    const results = await base44.entities.Product.filter({ sku: trimmed });

    if (!results || results.length === 0) {
      setNotFound(trimmed);
      setLastScanned(null);
      return;
    }

    const product = results[0];
    setItems((prev) => {
      const current = prev[trimmed] || { code: trimmed, name: product.name, brand: product.brand, size: product.size, count: 0 };
      return { ...prev, [trimmed]: { ...current, count: current.count + 1 } };
    });
    setLastScanned({ code: trimmed, product });
    setNotFound(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      processCode(input);
    }
  };

  const removeItem = (code) => {
    setItems((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const reset = () => {
    setItems({});
    setLastScanned(null);
  };

  const exportCSV = () => {
    const rows = [["Código", "Cantidad"], ...Object.values(items).map((i) => [i.code, i.count])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conteo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const sorted = Object.values(items).sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, i) => s + i.count, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conteo de Stock</h1>
          <p className="text-muted-foreground text-sm">Escaneá los códigos de barras para contar</p>
        </div>
        <div className="flex gap-2">
          {sorted.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="w-4 h-4" /> Reiniciar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scanner input */}
      <div className={`rounded-xl border-2 p-6 transition-all ${lastScanned ? "border-green-400 bg-green-50" : "border-dashed border-border bg-card"}`}>
        <div className="flex items-center gap-3 mb-4">
          <ScanLine className="w-5 h-5 text-primary" />
          <span className="font-medium">Zona de escaneo</span>
        </div>
        <input
          ref={inputRef}
          value={input}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => inputRef.current?.focus(), 50)}
          placeholder="Apuntá el lector acá o escribí el código..."
          className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
        />
        {lastScanned && (
          <p className="mt-3 text-sm text-green-700 font-medium">
            ✅ <span className="font-mono">{lastScanned.code}</span> — {lastScanned.product.name} {lastScanned.product.size} — total: {items[lastScanned.code]?.count}
          </p>
        )}
        {notFound && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">⚠️ Código <span className="font-mono">{notFound}</span> no encontrado en el sistema.</p>
            <p className="text-xs text-red-500 mt-1">Cargá el producto en la sección <strong>Productos</strong> con ese SKU/EAN y volvé a escanear.</p>
          </div>
        )}
      </div>

      {/* Summary */}
      {sorted.length > 0 && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
            <span className="font-semibold text-sm">{sorted.length} códigos distintos</span>
            <span className="text-sm font-bold text-primary">{total} unidades en total</span>
          </div>
          <div className="divide-y">
            {sorted.map((item) => (
              <div key={item.code} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-mono text-sm text-foreground">{item.code}</p>
                  {item.name && <p className="text-xs text-muted-foreground">{item.brand} — {item.name} {item.size}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary w-8 text-right">{item.count}</span>
                  <button onClick={() => removeItem(item.code)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ScanLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Todavía no escaneaste nada</p>
        </div>
      )}
    </div>
  );
}