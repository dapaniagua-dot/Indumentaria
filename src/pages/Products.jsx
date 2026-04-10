import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle } from "lucide-react";
import ProductDetail from "../components/ProductDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProductForm from "../components/ProductForm";
import { cn } from "@/lib/utils";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [sinFoto, setSinFoto] = useState(false);
  const [conFoto, setConFoto] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);

  const load = () => {
    base44.entities.Product.list("-updated_date", 500).then(data => {
      setProducts(data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const categories = ["Todos", ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchSearch = !search || [p.name, p.sku, p.brand, p.color, p.model_code].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchCat = categoryFilter === "Todos" || p.category === categoryFilter;
    const matchFoto = (!sinFoto || !p.image_url) && (!conFoto || !!p.image_url);
    return matchSearch && matchCat && matchFoto;
  });

  const handleDelete = async (id) => {
    if (!confirm("¿Estás seguro de que querés eliminar este producto?")) return;
    await base44.entities.Product.delete(id);
    load();
  };

  const handleSave = () => {
    setShowForm(false);
    setEditProduct(null);
    load();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Productos</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} productos registrados</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditProduct(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nuevo Producto
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, SKU, color..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                categoryFilter === cat ? "bg-primary text-white" : "bg-secondary text-secondary-foreground hover:bg-muted"
              )}>
              {cat}
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => { setSinFoto(v => !v); setConFoto(false); }}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                sinFoto ? "bg-destructive text-white" : "bg-secondary text-secondary-foreground hover:bg-muted"
              )}>
              Sin foto
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { setConFoto(v => !v); setSinFoto(false); }}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                conFoto ? "bg-primary text-white" : "bg-secondary text-secondary-foreground hover:bg-muted"
              )}>
              Con foto
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">SKU</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talle/Color</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cód. Modelo</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(p => {
                  const stockOk = (p.stock || 0) > (p.min_stock || 5);
                  const stockLow = (p.stock || 0) > 0 && (p.stock || 0) <= (p.min_stock || 5);
                  return (
                    <tr key={p.id} className="odd:bg-card even:bg-muted/30 hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => setViewProduct(p)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{p.name}</p>
                            <p className="text-xs text-white/60">{p.brand} · {p.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{p.sku}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/70">{p.size} / {p.color}</td>
                      <td className="px-5 py-4"><span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{p.model_code || '—'}</span></td>
                      <td className="px-5 py-4 text-center">
                        <span className={cn("inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full",
                          p.stock === 0 ? "bg-red-100 text-red-700" : stockLow ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                        )}>
                          {stockLow && <AlertTriangle className="w-3 h-3" />}
                          {p.stock || 0}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <>
                              <button onClick={() => { setEditProduct(p); setShowForm(true); }}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(p.id)}
                                className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-muted-foreground text-sm">Sin productos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewProduct && (
        <ProductDetail product={viewProduct} onClose={() => setViewProduct(null)} />
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}
    </div>
  );
}