import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** false quando as variáveis de ambiente do Supabase não foram configuradas. */
export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Extrai uma mensagem legível em português de erros do Supabase/JS. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    const m = err.message;
    if (m.includes('Failed to fetch')) return 'Sem conexão com o servidor. Tente novamente.';
    if (m.includes('row-level security')) return 'Você não tem permissão para fazer isso.';
    if (m.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (m.includes('User already registered')) return 'Este e-mail já possui conta. Use a aba "Já tenho conta" para entrar.';
    if (m.includes('Email not confirmed')) return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
    if (m.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
    if (m.includes('rate limit')) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
    if (m.includes('Unable to validate email address')) return 'Informe um endereço de e-mail válido.';
    return m;
  }
  return 'Algo deu errado. Tente novamente.';
}
