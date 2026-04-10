import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Remeras", "Pantalones", "Shorts", "Camperas", "Buzos", "Medias", "Calzado", "Accesorios"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Único", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

export default function ProductForm({ product, onSave, onClose }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    model_code: product?.model_code || "",
    category: product?.category || "",
    brand: product?.brand || "",
    size: product?.size || "",
    color: product?.color || "",

    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 5,
    description: product?.description || "",
    image_url: product?.image_url || "",
    active: product?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("image_url", file_url);
    setUploading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.sku) return alert("Nombre y SKU son obligatorios");
    setSaving(true);
    const data = { ...form, stock: Number(form.stock), min_stock: Number(form.min_stock) };
    if (product?.id) await base44.entities.Product.update(product.id, data);
    else await base44.entities.Product.create(data);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-bold">{product ? "Editar Producto" : "Nuevo Producto"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Remera Dry-Fit Azul" />
          </div>
          <div className="space-y-1">
            <Label>SKU / Código (EAN) *</Label>
            <Input value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="Ej: 4088759150065" />
          </div>
          <div className="space-y-1">
            <Label>Código de Modelo Adidas (ej: HT3676)</Label>
            <Input value={form.model_code} onChange={e => set("model_code", e.target.value)} placeholder="Ej: HT3676" />
          </div>
          <div className="space-y-1">
            <Label>Marca</Label>
            <Input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Ej: Nike, Adidas..." />
          </div>
          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select value={form.category} onValueChange={v => set("category", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Talle</Label>
            <Select value={form.size} onValueChange={v => set("size", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <Input value={form.color} onChange={e => set("color", e.target.value)} placeholder="Ej: Azul, Negro..." />
          </div>

          <div className="space-y-1">
            <Label>Stock Inicial</Label>
            <Input type="number" value={form.stock} onChange={e => set("stock", e.target.value)} placeholder="0" />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Imagen del Producto</Label>
            <div className="flex items-center gap-3">
              {form.image_url && (
                <img src={form.image_url} alt="preview" className="w-16 h-16 object-contain rounded-lg border border-border bg-muted" />
              )}
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground">
                <ImagePlus className="w-4 h-4" />
                {uploading ? "Subiendo..." : "Subir imagen"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
              {form.image_url && (
                <button onClick={() => set("image_url", "")} className="text-xs text-destructive hover:underline">Quitar</button>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </div>
      </div>
    </div>
  );
}