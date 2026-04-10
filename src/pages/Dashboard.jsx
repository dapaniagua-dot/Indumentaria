import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Shirt, Wind } from "lucide-react";

export default function Dashboard() {
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

  const stats = [
    { label: "Total Productos", value: totalProducts, icon: Package, color: "bg-blue-500/20 text-blue-400" },
    { label: "Unidades en Stock", value: totalStock.toLocaleString(), icon: Package, color: "bg-yellow-500/20 text-yellow-400" },
    { label: "Remeras", value: remeras, imgIcon: "https://media.base44.com/images/public/69d466d17a10f9a16fa574ce/559a103da_remera.png", color: "bg-blue-500/20" },
    { label: "Shorts", value: shorts, imgIcon: "https://media.base44.com/images/public/69d466d17a10f9a16fa574ce/52c129463_short.png", color: "bg-yellow-500/20" },
    { label: "Buzos", value: buzos, imgIcon: "https://media.base44.com/images/public/69d466d17a10f9a16fa574ce/487a484f1_buzo.png", color: "bg-blue-500/20" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Información</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen del inventario</p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-4">
        {stats.slice(0, 2).map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-4`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-muted-foreground text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Stats categorías */}
      <div className="grid grid-cols-3 gap-4">
        {stats.slice(2).map(({ label, value, icon: Icon, emoji, imgIcon, color }) => (
          <div key={label} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-4`}>
              {imgIcon ? <img src={imgIcon} alt={label} className="w-9 h-9 object-contain" /> : emoji ? <span className="text-xl">{emoji}</span> : <Icon className="w-5 h-5" />}
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-muted-foreground text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

    </div>
  );
}