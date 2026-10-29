import { useState } from 'react';
import { errorMessage, supabase } from '../lib/supabase';
import { inviteUrl, valueRange, whatsappShareUrl } from '../lib/format';
import type { Group } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';

export function InviteBox({
  group,
  isOwner,
  onRegenerated,
}: {
  group: Group;
  isOwner: boolean;
  onRegenerated: () => void;
}) {
  const url = inviteUrl(group.invite_code);
  const waUrl = whatsappShareUrl({
    name: group.name,
    url,
    eventAt: group.event_at,
    range: valueRange(group.min_value, group.max_value),
    rsvpDeadline: group.rsvp_deadline,
  });
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.');
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: group.name,
        text: `Você foi convidado(a) para o amigo secreto "${group.name}"! 🎁`,
        url,
      });
    } catch {
      /* usuário cancelou */
    }
  }

  async function regenerate() {
    const { error } = await supabase.rpc('regenerate_invite', { gid: group.id });
    if (error) setError(errorMessage(error));
    else onRegenerated();
  }

  return (
    <section className="card invite" aria-labelledby="invite-title">
      <h2 id="invite-title">🔗 Convide os participantes</h2>
      <p className="muted">
        Envie este link para quem vai participar. Cada pessoa entra com seu e-mail e confirma presença.
      </p>
      <div className="invite-row">
        <label htmlFor="invite-url" className="visually-hidden">
          Link de convite
        </label>
        <input id="invite-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn primary" onClick={copy}>
          {copied ? '✓ Copiado!' : 'Copiar link'}
        </button>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn secondary">
          WhatsApp
        </a>
        {canShare && (
          <button type="button" className="btn ghost" onClick={share}>
            Compartilhar
          </button>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {copied ? 'Link copiado para a área de transferência' : ''}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {isOwner && (
        <button type="button" className="btn link small" onClick={() => setConfirm(true)}>
          Gerar um novo link (invalida o atual)
        </button>
      )}
      <ConfirmDialog
        open={confirm}
        title="Gerar novo link?"
        confirmLabel="Gerar novo link"
        onConfirm={regenerate}
        onClose={() => setConfirm(false)}
      >
        <p>O link atual deixará de funcionar. Quem já entrou continua confirmado no grupo.</p>
      </ConfirmDialog>
    </section>
  );
}
