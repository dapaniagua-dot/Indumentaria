import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Printer, Search, QrCode, Barcode, Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BarcodeLabel from "../components/BarcodeLabel";

export default function Labels() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]); // [{ product, qty, type }]
  const [labelType, setLabelType] = useState("barcode"); // barcode | qr
  const printRef = useRef(null);

  useEffect(() => {
    base44.entities.Product.list("-name", 500).then(setProducts);
  }, []);

  const filtered = products.filter(p =>
    !search || [p.name, p.sku, p.brand].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const addProduct = (product) => {
    setSelected(prev => {
      const exists = prev.find(s => s.product.id === product.id);
      if (exists) return prev.map(s => s.product.id === product.id ? { ...s, qty: s.qty + 1 } : s);
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setSelected(prev => prev.map(s => s.product.id === id ? { ...s, qty: Math.max(1, s.qty + delta) } : s).filter(s => s.qty > 0));
  };

  const removeProduct = (id) => setSelected(prev => prev.filter(s => s.product.id !== id));

  const handlePrint = () => {
    const content = printRef.current;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Etiquetas SportStock</title>
      <style>
        @page { margin: 10mm; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .labels-grid { display: flex; flex-wrap: wrap; gap: 4mm; }
        .label { width: 60mm; border: 0.5mm solid #ccc; padding: 3mm; box-sizing: border-box; break-inside: avoid; }
        svg { display: block; max-width: 100%; }
        canvas { display: block; max-width: 100%; }
        p { margin: 1mm 0; font-size: 7pt; text-align: center; }
        .sku { font-size: 6pt; color: #555; }
        .price { font-size: 9pt; font-weight: bold; }
      </style></head>
      <body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const labelsToRender = selected.flatMap(s => Array(s.qty).fill(s.product));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Etiquetas</h1>
          <p className="text-muted-foreground text-sm mt-1">Genera e imprime etiquetas con código de barras o QR</p>
        </div>
        {selected.length > 0 && (
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir {labelsToRender.length} etiqueta{labelsToRender.length !== 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Label type toggle */}
      <div className="flex gap-3">
        <button onClick={() => setLabelType("barcode")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${labelType === "barcode" ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground"}`}>
          <Barcode className="w-4 h-4" /> Código de Barras
        </button>
        <button onClick={() => setLabelType("qr")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${labelType === "qr" ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground"}`}>
          <QrCode className="w-4 h-4" /> Código QR
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Product selector */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm mb-3">Seleccionar Productos</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar producto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {filtered.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.sku} · {p.size} · {p.color}</p>
                </div>
                <button onClick={() => addProduct(p)}
                  className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
            {filtered.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin productos</p>}
          </div>
        </div>

        {/* Selected products */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Etiquetas seleccionadas</h2>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {selected.map(s => (
              <div key={s.product.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.product.name}</p>
                  <p className="text-xs text-muted-foreground">{s.product.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(s.product.id, -1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{s.qty}</span>
                  <button onClick={() => updateQty(s.product.id, 1)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeProduct(s.product.id)} className="text-xs text-destructive hover:underline ml-2">Quitar</button>
                </div>
              </div>
            ))}
            {selected.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Selecciona productos de la lista</p>}
          </div>
        </div>
      </div>

      {/* Label preview */}
      {labelsToRender.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm mb-4">Vista Previa de Etiquetas</h2>
          <div ref={printRef} className="labels-grid flex flex-wrap gap-4">
            {labelsToRender.map((p, i) => (
              <BarcodeLabel key={i} product={p} type={labelType} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}