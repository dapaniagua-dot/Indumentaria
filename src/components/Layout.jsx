import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, History, Menu, X, Search, Layers, Truck, LogOut, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Panel de Información" },
  { to: "/products", icon: Package, label: "Productos" },
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
  const visibleNav = navItems.filter(item => {
    return isAdmin || !item.adminOnly;
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: "hsl(222 47% 11%)" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xs leading-tight">CONTROL DE STOCK</p>
            <p className="text-white/70 text-xs">INDUMENTARIA DISCONTINUADA</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "text-white/50 hover:text-white hover:bg-white/8"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-white/10 space-y-3">
          {user && (
            <div className="text-white/40 text-xs truncate">
              {user.full_name || user.email}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-white/40 hover:text-white text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-4 bg-card border-b border-border">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-xs">CONTROL DE STOCK INDUMENTARIA DISCONTINUADA</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}