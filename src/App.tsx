import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AuthProvider, consumeReturnTo, useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import { Layout, Spinner } from './components/Layout';
import { LoginButton } from './components/LoginButton';
import { Home } from './pages/Home';
import { NewGroup } from './pages/NewGroup';
import { EditGroup } from './pages/EditGroup';
import { Invite } from './pages/Invite';
import { GroupPage } from './pages/Group';

// BASE_URL vem do Vite ("/" localmente, "/<repo>/" no GitHub Pages)
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  if (!isConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <UrlRedirects />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="convite/:code" element={<Invite />} />
            <Route path="novo" element={<RequireAuth><NewGroup /></RequireAuth>} />
            <Route path="grupo/:id" element={<RequireAuth><GroupPage /></RequireAuth>} />
            <Route path="grupo/:id/editar" element={<RequireAuth><EditGroup /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

/**
 * 1) Converte /?convite=CODIGO em /convite/CODIGO (mantendo HTTP 200 na entrada do GitHub Pages).
 * 2) Depois do login com Google (PKCE ?code=...), volta para a rota salva antes do login.
 */
function UrlRedirects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const inviteCode = params.get('convite');
    if (inviteCode) {
      navigate(`/convite/${encodeURIComponent(inviteCode)}`, { replace: true });
      return;
    }

    if (!user) return;
    const target = consumeReturnTo();
    const current = location.pathname + location.search;
    if (target && target !== current) {
      navigate(target, { replace: true });
    } else if (params.has('code')) {
      navigate(location.pathname, { replace: true });
    }
  }, [user, navigate, location.pathname, location.search]);

  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) {
    return (
      <div className="empty-state">
        <h1>Entre para continuar</h1>
        <p className="muted">Use seu e-mail e senha para acessar seus amigos secretos.</p>
        <LoginButton />
      </div>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="card empty-state">
      <h1>Página não encontrada</h1>
      <Link to="/" className="btn ghost">
        Ir para o início
      </Link>
    </div>
  );
}

function SetupNeeded() {
  return (
    <main className="container main">
      <div className="card">
        <h1>⚙️ Configuração necessária</h1>
        <p>
          As variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> ainda não foram definidas.
        </p>
        <ol>
          <li>
            Crie um projeto gratuito no <strong>Supabase</strong> e execute o arquivo <code>supabase/schema.sql</code> no{' '}
            <em>SQL Editor</em>.
          </li>
          <li>
            Em <em>Authentication &gt; Providers &gt; Email</em> no Supabase, recomendamos desativar{' '}
            <strong>Confirm email</strong> para entrada imediata dos convidados.
          </li>
          <li>
            Copie <code>.env.example</code> para <code>.env.local</code>, preencha a URL e a Anon Key do projeto e
            reinicie o servidor (<code>npm run dev</code>).
          </li>
        </ol>
        <p className="muted">Consulte o arquivo <code>README.md</code> para o passo a passo detalhado.</p>
      </div>
    </main>
  );
}
