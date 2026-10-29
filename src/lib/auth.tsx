import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isConfigured, supabase } from './supabase';

const RETURN_KEY = 'amigo-secreto:return-to';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Retorna `needsEmailConfirmation = true` caso o projeto Supabase exija confirmação por link. */
  signUpWithEmail: (
    fullName: string,
    email: string,
    password: string,
    returnTo?: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(
    async (fullName: string, email: string, password: string, returnTo?: string) => {
      if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
        },
      });
      if (error) throw error;
      // Quando "Confirm email" está ativo e o e-mail já existe, o Supabase retorna identities vazio por segurança
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('User already registered');
      }
      return { needsEmailConfirmation: !data.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, session, loading, signInWithEmail, signUpWithEmail, signOut }),
    [session, loading, signInWithEmail, signUpWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

/** Lê (e apaga) a rota salva antes do login. */
export function consumeReturnTo(): string | null {
  const value = sessionStorage.getItem(RETURN_KEY);
  if (value) sessionStorage.removeItem(RETURN_KEY);
  return value;
}

export function userDisplayName(user: User | null): string {
  const m = user?.user_metadata ?? {};
  return (m.full_name || m.name || user?.email?.split('@')[0] || '') as string;
}

export function userAvatar(user: User | null): string | null {
  const m = user?.user_metadata ?? {};
  return (m.avatar_url || m.picture || null) as string | null;
}
