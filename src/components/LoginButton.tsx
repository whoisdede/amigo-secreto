import { useId, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/supabase';

export function LoginButton({ defaultMode = 'signin' }: { label?: string; defaultMode?: 'signin' | 'signup' }) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const location = useLocation();
  const uid = useId();

  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        const res = await signUpWithEmail(name, email, password, location.pathname + location.search);
        if (res.needsEmailConfirmation) {
          setInfo('📩 Enviamos um link de confirmação para o seu e-mail! Clique nele para ativar a conta e voltar.');
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card card">
      <div className="tabs" role="tablist" aria-label="Acesso com e-mail">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`tab ${mode === 'signin' ? 'active' : ''}`}
          onClick={() => {
            setMode('signin');
            setError(null);
            setInfo(null);
          }}
        >
          Já tenho conta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`tab ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => {
            setMode('signup');
            setError(null);
            setInfo(null);
          }}
        >
          Criar conta
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor={`${uid}-name`}>Seu nome</label>
            <input
              id={`${uid}-name`}
              name="name"
              type="text"
              required
              maxLength={60}
              autoComplete="name"
              placeholder="Ex.: André"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="error-msg">Informe seu nome.</p>
          </div>
        )}

        <div className="field">
          <label htmlFor={`${uid}-email`}>E-mail</label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            required
            autoComplete="username"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="error-msg">Informe um e-mail válido.</p>
        </div>

        <div className="field">
          <div className="pwd-label-row">
            <label htmlFor={`${uid}-pwd`}>Senha</label>
            <button
              type="button"
              className="btn link small pwd-toggle"
              aria-pressed={showPwd}
              onClick={() => setShowPwd((v) => !v)}
            >
              {showPwd ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {mode === 'signup' && (
            <span id={`${uid}-pwd-hint`} className="hint">
              Mínimo de 6 caracteres
            </span>
          )}
          <input
            id={`${uid}-pwd`}
            name="password"
            type={showPwd ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            aria-describedby={mode === 'signup' ? `${uid}-pwd-hint` : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="error-msg">A senha deve ter pelo menos 6 caracteres.</p>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="notice" role="status">
            {info}
          </p>
        )}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta e continuar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
