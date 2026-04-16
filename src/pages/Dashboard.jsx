import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Package } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Product.list("-updated_date", 200).then(p => {
      setProducts(p);
      setLoading(false);
    });
  }, []);

  const totalProducts = products.length;
  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
  const remeras = products.filter(p => p.category === "Remeras").reduce((s, p) => s + (p.stock || 0), 0);
  const shorts = products.filter(p => p.category === "Shorts").reduce((s, p) => s + (p.stock || 0), 0);
  const buzos = products.filter(p => p.category === "Buzos").reduce((s, p) => s + (p.stock || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const goToProducts = (category) => {
    navigate(category ? `/products?category=${encodeURIComponent(category)}` : "/products");
  };

  const mainStats = [
    { label: "Total Productos", value: totalProducts, icon: Package, accent: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-400", onClick: () => goToProducts() },
    { label: "Unidades en Stock", value: totalStock.toLocaleString(), icon: Package, accent: "from-primary/20 to-yellow-600/10", iconColor: "text-primary", onClick: () => goToProducts() },
  ];

  const categoryStats = [
    { label: "Remeras", value: remeras, imgIcon: "/images/559a103da_remera.png", accent: "from-blue-500/15 to-transparent", onClick: () => goToProducts("Remeras") },
    { label: "Shorts", value: shorts, imgIcon: "/images/52c129463_short.png", accent: "from-primary/15 to-transparent", onClick: () => goToProducts("Shorts") },
    { label: "Buzos", value: buzos, imgIcon: "/images/487a484f1_buzo.png", accent: "from-blue-500/15 to-transparent", onClick: () => goToProducts("Buzos") },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-cabj text-gold-gradient tracking-wide">Panel de Informacion</h1>
        <p className="text-muted-foreground text-sm font-industry mt-1">Resumen del inventario</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mainStats.map(({ label, value, icon: Icon, accent, iconColor, onClick }) => (
          <button key={label} onClick={onClick} type="button"
            className="group relative bg-card rounded-2xl p-6 border border-border hover:border-primary/40 transition-all duration-300 cursor-pointer boca-card-glow text-left overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <p className="text-3xl font-cabj text-foreground tracking-wide">{value}</p>
              <p className="text-muted-foreground text-xs font-industry mt-1 uppercase tracking-wider">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Category stats */}
      <div>
        <h2 className="text-sm font-industry font-semibold text-muted-foreground uppercase tracking-wider mb-4">Por Categoria</h2>
        <div className="grid grid-cols-3 gap-4">
          {categoryStats.map(({ label, value, imgIcon, accent, onClick }) => (
            <button key={label} onClick={onClick} type="button"
              className="group relative bg-card rounded-2xl p-5 border border-border hover:border-primary/40 transition-all duration-300 cursor-pointer boca-card-glow text-left overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                  <img src={imgIcon} alt={label} className="w-10 h-10 object-contain" />
                </div>
                <p className="text-2xl font-cabj text-foreground tracking-wide">{value}</p>
                <p className="text-muted-foreground text-xs font-industry mt-1 uppercase tracking-wider">{label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
