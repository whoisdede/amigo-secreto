import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth, userAvatar, userDisplayName } from '../lib/auth';
import { errorMessage, supabase } from '../lib/supabase';
import { formatDateTime, isPast, relativeTime, valueRange } from '../lib/format';
import type { InvitePreview } from '../lib/types';
import { LoginButton } from '../components/LoginButton';
import { Spinner } from '../components/Layout';

export function Invite() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    supabase.rpc('get_invite', { code: code! }).then(({ data, error }) => {
      if (error) setError(errorMessage(error));
      setInvite(((data as InvitePreview[] | null) ?? [])[0] ?? null);
      setLoading(false);
    });
  }, [code, authLoading, user?.id]);

  async function join(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setJoining(true);
    setError(null);
    const { data, error } = await supabase.rpc('join_group', {
      code: code!,
      p_display_name: String(fd.get('display_name')).trim(),
      p_avatar_url: userAvatar(user),
    });
    setJoining(false);
    if (error) setError(errorMessage(error));
    else navigate(`/grupo/${data}`);
  }

  if (loading || authLoading) return <Spinner />;

  if (!invite) {
    return (
      <div className="card empty-state">
        <p className="hero-emoji" aria-hidden="true">
          😕
        </p>
        <h1>Convite não encontrado</h1>
        <p className="muted">O link pode estar errado ou o organizador gerou um novo. Peça o link atualizado.</p>
        <Link to="/" className="btn ghost">
          Ir para o início
        </Link>
      </div>
    );
  }

  const count = Number(invite.participant_count);
  const range = valueRange(invite.min_value, invite.max_value);
  const deadlinePassed = isPast(invite.rsvp_deadline);
  const full = invite.max_participants != null && count >= Number(invite.max_participants);
  const closedReason =
    invite.status === 'drawn'
      ? 'O sorteio já foi realizado — não é mais possível entrar.'
      : deadlinePassed
        ? 'O prazo para confirmar participação terminou.'
        : full
          ? 'O grupo atingiu o limite de participantes.'
          : null;

  return (
    <section className="invite-page">
      <div className="card invite-card">
        <p className="eyebrow">Você foi convidado(a) por {invite.owner_name} 🎉</p>
        <h1>{invite.name}</h1>
        {invite.description && <p className="lead pre">{invite.description}</p>}
        <dl className="details">
          {invite.event_at && (
            <div>
              <dt>📅 Quando</dt>
              <dd>{formatDateTime(invite.event_at)}</dd>
            </div>
          )}
          {invite.location && (
            <div>
              <dt>📍 Onde</dt>
              <dd>{invite.location}</dd>
            </div>
          )}
          {range && (
            <div>
              <dt>💰 Valor do presente</dt>
              <dd>{range}</dd>
            </div>
          )}
          <div>
            <dt>👥 Participantes</dt>
            <dd>
              {count}
              {invite.max_participants ? ` de ${invite.max_participants}` : ''} confirmados
            </dd>
          </div>
          {invite.rsvp_deadline && (
            <div>
              <dt>⏰ Confirme até</dt>
              <dd>
                {formatDateTime(invite.rsvp_deadline)} ({relativeTime(invite.rsvp_deadline)})
              </dd>
            </div>
          )}
        </dl>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {invite.is_member ? (
          <Link to={`/grupo/${invite.id}`} className="btn primary">
            Abrir grupo →
          </Link>
        ) : closedReason ? (
          <p className="notice">{closedReason}</p>
        ) : !user ? (
          <div className="join-box">
            <p>Crie uma conta rápida (ou entre com seu e-mail) para confirmar sua participação:</p>
            <LoginButton defaultMode="signup" />
          </div>
        ) : (
          <form className="join-box" onSubmit={join}>
            <div className="field">
              <label htmlFor="display_name">Como você quer aparecer no grupo?</label>
              <input
                id="display_name"
                name="display_name"
                required
                maxLength={60}
                defaultValue={userDisplayName(user)}
                autoComplete="name"
              />
              <p className="error-msg">Informe seu nome.</p>
            </div>
            <button type="submit" className="btn primary big" disabled={joining}>
              {joining ? 'Confirmando…' : '🎁 Confirmar participação'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
