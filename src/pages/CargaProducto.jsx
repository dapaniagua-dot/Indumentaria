import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Upload, Camera, Tag, Package, Check, X, Loader2, AlertTriangle, RotateCcw, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const INITIAL = { name: "", brand: "", model_code: "", category: "", size: "", color: "", publicidad: false };

export default function CargaProducto() {
  const { token } = useAuth();
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [labelFile, setLabelFile] = useState(null);
  const [labelPreview, setLabelPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [extractedData, setExtractedData] = useState(INITIAL);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedProduct, setSavedProduct] = useState(null);

  const handleLabelChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLabelFile(file);
    setLabelPreview(URL.createObjectURL(file));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleAnalyze = async () => {
    if (!labelFile || !photoFile || !sku) return;
    setAnalyzing(true);
    setError("");

    try {
      // Check if SKU already exists
      const existing = await base44.entities.Product.list("-created_date", 500);
      const duplicate = existing.find(p => p.sku === sku.trim());
      if (duplicate) {
        setError(`El SKU ${sku} ya existe: "${duplicate.name}" (${duplicate.size} / ${duplicate.color}). Revisalo en la seccion de Productos.`);
        setAnalyzing(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", labelFile);
      const res = await fetch("/api/analyze-label", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setAnalyzing(false); return; }
      setExtractedData(data);
      setStep("preview");
    } catch {
      setError("Error de conexion con el servidor");
    }
    setAnalyzing(false);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError("");

    try {
      // Upload product photo
      const formData = new FormData();
      formData.append("file", photoFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { setError(uploadData.error); setSaving(false); return; }

      // Create product
      const product = await base44.entities.Product.create({
        ...extractedData,
        sku,
        stock: parseInt(quantity) || 0,
        image_url: uploadData.file_url,
        price: 0,
        cost: 0,
        min_stock: 5,
        active: true,
      });

      // Create stock movement
      await base44.entities.StockMovement.create({
        product_id: product.id,
        product_name: extractedData.name,
        product_sku: sku,
        type: "entrada",
        quantity: parseInt(quantity) || 0,
        notes: "Carga inicial de producto",
        reference: "",
      });

      setSavedProduct(product);
      setStep("done");
    } catch (err) {
      setError("Error al guardar: " + err.message);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setStep("upload");
    setLabelFile(null);
    setLabelPreview(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSku("");
    setQuantity(1);
    setExtractedData(INITIAL);
    setError("");
    setSavedProduct(null);
  };

  const set = (k, v) => setExtractedData(d => ({ ...d, [k]: v }));

  // --- STEP: Upload ---
  if (step === "upload") {
    const ready = labelFile && photoFile && sku.trim();
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Cargar Producto</h1>
          <p className="text-muted-foreground text-sm mt-1">Subi la etiqueta y la foto del producto para crear la ficha automaticamente</p>
        </div>

        <div className="space-y-5">
          {/* Label upload */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <Label className="flex items-center gap-2 text-white font-semibold">
              <Tag className="w-4 h-4 text-primary" /> Etiqueta del producto
            </Label>
            {labelPreview ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary bg-primary/5 rounded-xl p-6 cursor-pointer transition-all">
                <img src={labelPreview} alt="Etiqueta" className="max-h-48 object-contain rounded-lg" />
                <p className="text-xs text-muted-foreground mt-2">Click para cambiar</p>
                <input type="file" accept="image/*" className="hidden" onChange={handleLabelChange} />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all">
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Cámara</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleLabelChange} />
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Galería</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLabelChange} />
                </label>
              </div>
            )}
          </div>

          {/* Photo upload */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <Label className="flex items-center gap-2 text-white font-semibold">
              <Camera className="w-4 h-4 text-primary" /> Foto del producto
            </Label>
            {photoPreview ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary bg-primary/5 rounded-xl p-6 cursor-pointer transition-all">
                <img src={photoPreview} alt="Producto" className="max-h-48 object-contain rounded-lg" />
                <p className="text-xs text-muted-foreground mt-2">Click para cambiar</p>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all">
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Cámara</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 cursor-pointer transition-all">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Galería</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
            )}
          </div>

          {/* SKU & Quantity */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-white font-semibold">SKU (codigo de barras)</Label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ej: 4067896782362" />
              </div>
              <div className="space-y-1">
                <Label className="text-white font-semibold">Cantidad</Label>
                <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button onClick={handleAnalyze} disabled={!ready || analyzing} className="w-full gap-2 py-6 text-base">
            {analyzing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Analizando etiqueta...</>
            ) : (
              <><Upload className="w-5 h-5" /> Analizar y continuar</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // --- STEP: Preview ---
  if (step === "preview") {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Vista Previa</h1>
          <p className="text-muted-foreground text-sm mt-1">Revisa los datos extraidos de la etiqueta. Podes editar cualquier campo antes de confirmar.</p>
        </div>

        {/* Product card preview */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {photoPreview && (
            <img src={photoPreview} alt="Producto" className="w-full h-56 object-contain bg-muted/20 p-4" />
          )}
          <div className="p-5 space-y-4">
            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input value={extractedData.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Marca</Label>
                <Input value={extractedData.brand} onChange={e => set("brand", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Codigo Modelo</Label>
                <Input value={extractedData.model_code} onChange={e => set("model_code", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <select value={extractedData.category} onChange={e => set("category", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Seleccionar</option>
                  <option value="Remeras">Remeras</option>
                  <option value="Shorts">Shorts</option>
                  <option value="Buzos">Buzos</option>
                  <option value="Camperas">Camperas</option>
                  <option value="Pantalones">Pantalones</option>
                  <option value="Medias">Medias</option>
                  <option value="Musculosas">Musculosas</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Talle</Label>
                <Input value={extractedData.size} onChange={e => set("size", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <Input value={extractedData.color} onChange={e => set("color", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Publicidad</Label>
                <select value={extractedData.publicidad ? "si" : "no"} onChange={e => set("publicidad", e.target.value === "si")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>
            </div>

            {/* Read-only info */}
            <div className="flex gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">SKU</p>
                <p className="text-sm font-mono text-white">{sku}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cantidad</p>
                <p className="text-sm font-bold text-white">{quantity}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-700" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("upload")} className="flex-1 gap-2">
            <X className="w-4 h-4" /> Volver
          </Button>
          <Button onClick={handleConfirm} disabled={saving} className="flex-1 gap-2">
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><Check className="w-4 h-4" /> Confirmar y guardar</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // --- STEP: Done ---
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-white">Producto cargado</h2>
        <p className="text-muted-foreground text-sm">
          <strong>{extractedData.name}</strong> — {quantity} unidades con SKU {sku}
        </p>
        <Button onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" /> Cargar otro producto
        </Button>
      </div>
    </div>
  );
}
