import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Movements from './pages/Movements';
import Consulta from './pages/Consulta';
import Entregas from './pages/Entregas';
import Login from './pages/Login';
import Users from './pages/Users';
import CargaProducto from './pages/CargaProducto';

// Página de inicio según el rol (los "carga" no ven el Dashboard)
const homeFor = (role) => (role === 'carga' ? '/carga' : '/');

const RoleRoute = ({ allow, children }) => {
  const { user } = useAuth();
  if (!allow.includes(user?.role)) return <Navigate to={homeFor(user?.role)} replace />;
  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, needsSetup, login } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} needsSetup={needsSetup} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<RoleRoute allow={['admin', 'viewer']}><Dashboard /></RoleRoute>} />
        <Route path="/products" element={<RoleRoute allow={['admin', 'viewer', 'carga']}><Products /></RoleRoute>} />
        <Route path="/movements" element={<RoleRoute allow={['admin', 'viewer']}><Movements /></RoleRoute>} />
        <Route path="/consulta" element={<RoleRoute allow={['admin', 'viewer']}><Consulta /></RoleRoute>} />
        <Route path="/entregas" element={<RoleRoute allow={['admin']}><Entregas /></RoleRoute>} />
        <Route path="/users" element={<RoleRoute allow={['admin']}><Users /></RoleRoute>} />
        <Route path="/carga" element={<RoleRoute allow={['admin', 'carga']}><CargaProducto /></RoleRoute>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
