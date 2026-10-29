import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAuth } from '../lib/auth';
import { errorMessage, supabase } from '../lib/supabase';
import { formatShort, formatTime } from '../lib/format';
import type { ChatMessage, ChatThread } from '../lib/types';

const POLL_MS = 10_000;

const THREADS: Record<ChatThread, { tab: string; hint: string; them: string }> = {
  giftee: {
    tab: 'Com quem eu tirei',
    hint: 'Você aparece como “Amigo secreto” — a pessoa não sabe quem você é. Pergunte do que ela gosta!',
    them: 'Seu amigo(a)',
  },
  santa: {
    tab: 'Com quem me tirou',
    hint: 'Converse com quem tirou você, sem saber quem é. Dê dicas do que gostaria de ganhar!',
    them: 'Amigo secreto 🤫',
  },
};

export function Chat({ groupId, giftee }: { groupId: string; giftee: string }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<ChatThread>('giftee');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_chat', { gid: groupId });
    if (error) setError(errorMessage(error));
    else {
      setError(null);
      setMessages((data ?? []) as ChatMessage[]);
    }
  }, [groupId]);

  // Busca inicial + atualização periódica enquanto a aba está visível
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Controle de "não lidas" salvo por usuário + grupo + conversa no navegador
  const seenKey = useCallback(
    (t: ChatThread) => `amigo-secreto:seen:${user?.id ?? 'anon'}:${groupId}:${t}`,
    [user?.id, groupId],
  );
  const [seen, setSeen] = useState<Record<ChatThread, number>>(() => ({
    giftee: Number(localStorage.getItem(seenKey('giftee')) ?? 0),
    santa: Number(localStorage.getItem(seenKey('santa')) ?? 0),
  }));

  const visible = messages.filter((m) => m.thread === thread);
  const unread = (t: ChatThread) => messages.filter((m) => m.thread === t && !m.from_me && m.id > seen[t]).length;

  useEffect(() => {
    const maxId = visible.reduce((max, m) => Math.max(max, m.id), 0);
    if (maxId > seen[thread]) {
      localStorage.setItem(seenKey(thread), String(maxId));
      setSeen((s) => ({ ...s, [thread]: maxId }));
    }
  }, [visible, seen, seenKey, thread]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, thread]);

  async function send(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const input = form.elements.namedItem('body') as HTMLTextAreaElement;
    const body = input.value.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.rpc('send_message', { gid: groupId, thread, body });
    setSending(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    input.value = '';
    input.focus();
    load();
  }

  // Enter envia, Shift+Enter quebra linha (respeitando composição de IME)
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const info = THREADS[thread];
  const themLabel = thread === 'giftee' ? giftee : info.them;

  return (
    <section className="card chat" aria-labelledby="chat-title">
      <div className="section-head">
        <h2 id="chat-title">💬 Mensagens anônimas</h2>
        <button type="button" className="btn ghost small" onClick={load} title="Buscar novas mensagens">
          ↻ Atualizar
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Conversas">
        {(Object.keys(THREADS) as ChatThread[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={thread === t}
            aria-controls="chat-panel"
            className={`tab ${thread === t ? 'active' : ''}`}
            onClick={() => setThread(t)}
          >
            {THREADS[t].tab}
            {unread(t) > 0 && (
              <span className="badge-count" aria-label={`${unread(t)} não lidas`}>
                {unread(t)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div id="chat-panel" role="tabpanel" aria-labelledby={`tab-${thread}`}>
        <p className="hint">{info.hint}</p>
        <ol className="messages" ref={listRef} aria-live="polite">
          {visible.length === 0 && <li className="muted empty">Nenhuma mensagem ainda.</li>}
          {visible.map((m) => (
            <li key={m.id} className={`msg ${m.from_me ? 'me' : 'them'}`}>
              <span className="msg-author">{m.from_me ? 'Você' : themLabel}</span>
              <p>{m.body}</p>
              <time dateTime={m.created_at} title={formatShort(m.created_at)}>
                {formatTime(m.created_at)}
              </time>
            </li>
          ))}
        </ol>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form ref={formRef} className="chat-form" onSubmit={send}>
          <label htmlFor="chat-body" className="visually-hidden">
            Mensagem
          </label>
          <textarea
            id="chat-body"
            name="body"
            rows={2}
            maxLength={1000}
            required
            placeholder="Escreva uma mensagem…"
            onKeyDown={onKeyDown}
            enterKeyHint="send"
          />
          <button type="submit" className="btn primary" disabled={sending}>
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
