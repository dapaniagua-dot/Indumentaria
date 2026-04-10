import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ScanLine, Package, AlertTriangle } from "lucide-react";

export default function Consulta() {
  const [input, setInput] = useState("");
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (input.trim()) processCode(input);
        return;
      }
      // Redirigir foco al input para que el lector escriba ahí
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, [input]);

  const processCode = async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setInput("");
    setProduct(null);
    setNotFound(null);

    const results = await base44.entities.Product.filter({ sku: trimmed });
    if (!results || results.length === 0) {
      setNotFound(trimmed);
      return;
    }
    setProduct(results[0]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      processCode(input);
    }
  };

  const stockColor = product
    ? product.stock === 0
      ? "text-red-600 bg-red-50 border-red-200"
      : product.stock <= (product.min_stock || 5)
      ? "text-yellow-600 bg-yellow-50 border-yellow-200"
      : "text-green-600 bg-green-50 border-green-200"
    : "";

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consulta de Stock</h1>
        <p className="text-muted-foreground text-sm">Escaneá un código de barras para ver la ficha del producto</p>
      </div>

      {/* Scanner input */}
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-6">
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
      </div>

      {/* Not found */}
      {notFound && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 font-medium">⚠️ Código <span className="font-mono">{notFound}</span> no encontrado.</p>
        </div>
      )}

      {/* Product card */}
      {product && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="w-full h-56 object-contain bg-gray-50 p-4" />
          )}
          {!product.image_url && (
            <div className="w-full h-32 bg-primary/5 flex items-center justify-center">
              <Package className="w-10 h-10 text-primary/30" />
            </div>
          )}
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-xl font-bold">{product.name}</h2>
              <p className="text-muted-foreground text-sm">{product.brand} · {product.category}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">SKU / EAN</p>
                <p className="font-mono font-semibold">{product.sku}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">Talle / Color</p>
                <p className="font-semibold">{product.size} / {product.color}</p>
              </div>
              {product.price > 0 && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Precio</p>
                  <p className="font-semibold">${product.price?.toLocaleString("es-AR")}</p>
                </div>
              )}
              <div className={`rounded-lg p-3 border ${stockColor}`}>
                <p className="text-xs mb-1 opacity-70">Stock actual</p>
                <div className="flex items-center gap-1">
                  {product.stock <= (product.min_stock || 5) && product.stock > 0 && (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <p className="text-2xl font-bold">{product.stock || 0}</p>
                  <p className="text-xs opacity-70 self-end mb-1">unidades</p>
                </div>
              </div>
            </div>
            {product.description && (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            )}
          </div>
        </div>
      )}

      {!product && !notFound && (
        <div className="text-center py-16 text-muted-foreground">
          <ScanLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Esperando escaneo...</p>
        </div>
      )}
    </div>
  );
}