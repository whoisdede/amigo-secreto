import { Link, Outlet } from 'react-router';
import { useAuth, userAvatar, userDisplayName } from '../lib/auth';
import { Avatar } from './Avatar';

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span aria-hidden="true">🎁</span> Amigo Secreto
          </Link>
          {user && (
            <div className="user-menu">
              <Avatar name={userDisplayName(user)} url={userAvatar(user)} size={32} />
              <span className="user-name">{userDisplayName(user)}</span>
              <button type="button" className="btn ghost small" onClick={signOut}>
                Sair
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">Feito com ❤️ para trocar presentes com quem você gosta.</div>
      </footer>
    </>
  );
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
