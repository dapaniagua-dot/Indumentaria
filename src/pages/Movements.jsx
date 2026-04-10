import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowUpRight, ArrowDownRight, Filter, Printer, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateEntregaPDF } from "@/lib/entregaPdf";

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("movimientos");
  const [selectedEntrega, setSelectedEntrega] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.StockMovement.list("-created_date", 500),
      base44.entities.Entrega.list("-created_date", 200)
    ]).then(([m, e]) => {
      setMovements(m);
      setEntregas(e);
      setLoading(false);
    });
  }, []);

  const filtered = movements.filter(m => {
    const matchType = typeFilter === "todos" || m.type === typeFilter;
    const matchSearch = !search || [m.product_name, m.product_sku].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const filteredEntregas = entregas.filter(e => {
    if (!search) return true;
    return [e.receptor_nombre, e.receptor_apellido, e.receptor_dni, e.sector]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()));
  });

  const totalIn = movements.filter(m => m.type === "entrada").reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => m.type === "salida").reduce((s, m) => s + m.quantity, 0);

  const printEntrega = (entrega) => {
    const doc = generateEntregaPDF(entrega);
    doc.save(`entrega-${entrega.receptor_apellido}-${entrega.fecha_hora?.replace(/[/:, ]/g, "-")}.pdf`);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimientos</h1>
        <p className="text-muted-foreground text-sm mt-1">Historial completo de entradas, salidas y entregas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalIn.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total entradas</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalOut.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total salidas</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{movements.length}</p>
              <p className="text-xs text-muted-foreground">Total movimientos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => setActiveTab("movimientos")}
          className={cn("px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2",
            activeTab === "movimientos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}>
          Movimientos
        </button>
        <button
          onClick={() => setActiveTab("entregas")}
          className={cn("px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2",
            activeTab === "entregas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}>
          Entregas ({entregas.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={activeTab === "movimientos" ? "Buscar producto o SKU..." : "Buscar por nombre, apellido, sector..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        {activeTab === "movimientos" && (
          <div className="flex gap-2">
            {["todos", "entrada", "salida"].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={cn("px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all",
                  typeFilter === t
                    ? t === "entrada" ? "bg-green-500 text-white" : t === "salida" ? "bg-red-500 text-white" : "bg-primary text-white"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                )}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : activeTab === "movimientos" ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">SKU</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cantidad</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                        m.type === "entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {m.type === "entrada" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {m.type}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium">{m.product_name}</td>
                    <td className="px-5 py-4"><span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{m.product_sku}</span></td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn("font-bold text-sm", m.type === "entrada" ? "text-green-600" : "text-red-600")}>
                        {m.type === "entrada" ? "+" : "-"}{m.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(m.created_date).toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{m.notes || "-"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">Sin movimientos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receptor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">DNI</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sector</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prendas</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEntregas.map(e => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedEntrega(e)}>
                    <td className="px-5 py-4 text-sm font-medium">{e.receptor_nombre} {e.receptor_apellido}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{e.receptor_dni || "-"}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{e.sector || "-"}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-bold text-sm text-primary">{e.total_prendas}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{e.fecha_hora}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={ev => { ev.stopPropagation(); printEntrega(e); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-xs font-medium transition-colors">
                        <Printer className="w-3.5 h-3.5" /> Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEntregas.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">Sin entregas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Entrega Detail Modal */}
      {selectedEntrega && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-lg font-bold">Detalle de Entrega</h2>
              <button onClick={() => setSelectedEntrega(null)} className="p-2 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{selectedEntrega.fecha_hora}</p></div>
                <div><p className="text-xs text-muted-foreground">Sector</p><p className="font-medium">{selectedEntrega.sector || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Receptor</p><p className="font-medium">{selectedEntrega.receptor_nombre} {selectedEntrega.receptor_apellido}</p></div>
                <div><p className="text-xs text-muted-foreground">DNI</p><p className="font-medium">{selectedEntrega.receptor_dni || "-"}</p></div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Prendas ({selectedEntrega.total_prendas})</p>
                <div className="space-y-2">
                  {(selectedEntrega.prendas || []).map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-muted/30 text-sm">
                      <div>
                        <p className="font-medium">{p.product_name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku} · {p.size || "-"} · {p.color || "-"}</p>
                      </div>
                      <span className="font-bold text-primary">×{p.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                Entregado por: {selectedEntrega.entregado_por_nombre} ({selectedEntrega.entregado_por_email})
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <Button onClick={() => printEntrega(selectedEntrega)} className="gap-2">
                <Printer className="w-4 h-4" /> Imprimir PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}