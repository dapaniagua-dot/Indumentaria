import { X } from "lucide-react";

export default function ProductDetail({ product, onClose }) {
  if (!product) return null;

  const Field = ({ label, value }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <div className="border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-muted/20">{value || "—"}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border" style={{maxHeight: '95vh', overflowY: 'auto'}}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-bold">Ficha del Producto</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        {product.image_url && (
          <div className="px-6 pt-6">
            <img src={product.image_url} alt={product.name} className="w-full h-56 object-contain rounded-xl border border-border bg-muted/20" />
          </div>
        )}

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Nombre" value={product.name} />
          </div>
          <Field label="SKU / Código (EAN)" value={product.sku} />
          <Field label="Código de Modelo Adidas" value={product.model_code} />
          <Field label="Marca" value={product.brand} />
          <Field label="Categoría" value={product.category} />
          <Field label="Talle" value={product.size} />
          <Field label="Color" value={product.color} />
          {product.tiene_variante_publicidad ? (
            <>
              <Field label="Sin publicidad" value={product.stock_sin_pub ?? 0} />
              <Field label="Con publicidad" value={product.stock_con_pub ?? 0} />
              <div className="sm:col-span-2">
                <Field label="Stock total" value={(product.stock_sin_pub ?? 0) + (product.stock_con_pub ?? 0)} />
              </div>
            </>
          ) : (
            <Field label="Stock" value={product.stock ?? 0} />
          )}
          {product.description && (
            <div className="sm:col-span-2">
              <Field label="Descripción" value={product.description} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}