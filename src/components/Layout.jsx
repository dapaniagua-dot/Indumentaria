import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, History, Menu, X, Search, Truck, LogOut, Users, PackagePlus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import AdidasLogo from "./AdidasLogo";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Panel de Informacion" },
  { to: "/products", icon: Package, label: "Productos" },
  { to: "/carga", icon: PackagePlus, label: "Cargar Producto", adminOnly: true },
  { to: "/entregas", icon: Truck, label: "Entregas", adminOnly: true },
  { to: "/movements", icon: History, label: "Movimientos" },
  { to: "/consulta", icon: Search, label: "Consulta" },
  { to: "/users", icon: Users, label: "Usuarios", adminOnly: true },
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const visibleNav = navItems.filter(item => isAdmin || !item.adminOnly);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: "hsl(222 70% 8%)" }}>

        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center flex-shrink-0 gold-border-glow">
              <AdidasLogo className="w-6 h-6" color="hsl(222 65% 11%)" />
            </div>
            <div>
              <p className="font-cabj text-primary text-sm leading-tight tracking-wide">CONTROL DE STOCK</p>
              <p className="text-white/30 text-[10px] font-industry tracking-widest uppercase">Indumentaria</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-4 pb-2 text-[10px] font-industry font-semibold text-white/20 uppercase tracking-[0.15em]">Menu</p>
          {visibleNav.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-industry font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          {user && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <span className="text-xs font-industry font-bold text-primary">
                  {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white/60 text-xs font-industry truncate">{user.full_name || user.email}</p>
                <p className="text-white/25 text-[10px] font-industry uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-white/25 hover:text-white/60 text-xs font-industry transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-card border-b border-border">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center">
              <AdidasLogo className="w-4 h-4" color="hsl(222 65% 11%)" />
            </div>
            <span className="font-cabj text-primary text-xs tracking-wide">CONTROL DE STOCK</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
