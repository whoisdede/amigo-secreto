import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth, userAvatar, userDisplayName } from '../lib/auth';
import { errorMessage, supabase } from '../lib/supabase';
import {
  downloadIcs,
  formatDateTime,
  formatShort,
  googleCalendarUrl,
  isPast,
  relativeTime,
  valueRange,
} from '../lib/format';
import type { Group, MyMatch, Participant, WishlistItem } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Chat } from '../components/Chat';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InviteBox } from '../components/InviteBox';
import { Spinner } from '../components/Layout';
import { WishlistEditor, WishlistView } from '../components/Wishlist';

type DialogKind = 'draw' | 'reset' | 'delete' | 'leave' | { remove: Participant } | null;

export function GroupPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [match, setMatch] = useState<MyMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const load = useCallback(async () => {
    const [g, p, w, m] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).maybeSingle(),
      supabase.from('participants').select('*').eq('group_id', id).order('joined_at'),
      supabase.from('wishlist_items').select('*').eq('group_id', id).order('created_at'),
      supabase.rpc('get_my_assignment', { gid: id }),
    ]);
    const firstError = g.error ?? p.error ?? w.error ?? m.error;
    if (firstError) setError(errorMessage(firstError));
    setGroup(g.data as Group | null);
    setParticipants((p.data ?? []) as Participant[]);
    setWishlist((w.data ?? []) as WishlistItem[]);
    setMatch(((m.data as MyMatch[] | null) ?? [])[0] ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Executa uma ação, mostra erro se houver e recarrega os dados. */
  async function run(action: () => PromiseLike<{ error: unknown }>, after?: () => void) {
    setBusy(true);
    setError(null);
    const { error } = await action();
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    if (after) after();
    else load();
  }

  async function saveMyName(e: FormEvent<HTMLFormElement>, myId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newName = String(fd.get('display_name') ?? '').trim();
    if (!newName) return;
    await run(
      () => supabase.from('participants').update({ display_name: newName }).eq('id', myId),
      () => {
        setEditingName(false);
        load();
      },
    );
  }

  if (loading) return <Spinner />;
  if (!group) {
    return (
      <div className="card empty-state">
        <h1>Amigo secreto não encontrado</h1>
        <p className="muted">Ele pode ter sido excluído, ou você ainda não entrou pelo link de convite.</p>
        <Link to="/" className="btn ghost">
          Ir para o início
        </Link>
      </div>
    );
  }

  const isOwner = group.owner_id === user?.id;
  const me = participants.find((p) => p.user_id === user?.id) ?? null;
  const isOpen = group.status === 'open';
  const range = valueRange(group.min_value, group.max_value);
  const gcal = googleCalendarUrl(group);
  const itemsOf = (pid: string) => wishlist.filter((w) => w.participant_id === pid);
  const others = participants.filter((p) => p.id !== me?.id);
  const canDraw = participants.length >= 3;

  return (
    <article className="group-page">
      <header className="page-head">
        <div>
          <div className="tags">
            <span className={`badge ${group.status}`}>{isOpen ? 'Inscrições abertas' : '🎉 Sorteio realizado'}</span>
            {isOwner && <span className="badge owner">Você é o organizador</span>}
          </div>
          <h1>{group.name}</h1>
        </div>
        {isOwner && (
          <Link to={`/grupo/${id}/editar`} className="btn ghost">
            ✏️ Editar
          </Link>
        )}
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* ---------- Resultado do sorteio ---------- */}
      {!isOpen && me && match && (
        <section className="card match" aria-labelledby="match-title">
          <h2 id="match-title">🤫 Seu amigo secreto</h2>
          {revealed ? (
            <>
              <div className="match-person">
                <Avatar name={match.display_name} url={match.avatar_url} size={72} />
                <p className="match-name">{match.display_name}</p>
              </div>
              <h3>Lista de desejos de {match.display_name.split(' ')[0]}</h3>
              <WishlistView items={itemsOf(match.receiver_id)} />
              <button type="button" className="btn ghost small" onClick={() => setRevealed(false)}>
                Esconder
              </button>
            </>
          ) : (
            <>
              <p className="muted">Certifique-se de que ninguém está olhando para a sua tela 👀</p>
              <button type="button" className="btn primary big" onClick={() => setRevealed(true)}>
                🎁 Revelar quem eu tirei
              </button>
            </>
          )}
        </section>
      )}
      {!isOpen && !me && (
        <p className="notice">O sorteio já foi feito e você não está entre os participantes.</p>
      )}

      {!isOpen && me && match && <Chat groupId={id} giftee={match.display_name} />}

      {/* ---------- Detalhes ---------- */}
      <section className="card" aria-labelledby="details-title">
        <div className="section-head">
          <h2 id="details-title">📋 Detalhes</h2>
          {gcal && (
            <div className="actions">
              <a href={gcal} target="_blank" rel="noopener noreferrer" className="btn ghost small">
                📅 Google Agenda
              </a>
              <button type="button" className="btn ghost small" onClick={() => downloadIcs(group)}>
                📥 Baixar .ics
              </button>
            </div>
          )}
        </div>
        {group.description && <p className="pre">{group.description}</p>}
        <dl className="details">
          <Detail label="📅 Data">
            {group.event_at ? (
              <>
                {formatDateTime(group.event_at)} <span className="muted">({relativeTime(group.event_at)})</span>
              </>
            ) : (
              'A definir'
            )}
          </Detail>
          <Detail label="📍 Local">
            {group.location ?? (group.location_url ? '' : 'A definir')}
            {group.location_url && (
              <>
                {' '}
                <a href={group.location_url} target="_blank" rel="noopener noreferrer">
                  Ver no mapa ↗
                </a>
              </>
            )}
          </Detail>
          {range && <Detail label="💰 Valor do presente">{range}</Detail>}
          {group.rsvp_deadline && (
            <Detail label="⏰ Confirmar até">
              {formatShort(group.rsvp_deadline)}{' '}
              <span className={isPast(group.rsvp_deadline) ? 'error-text' : 'muted'}>
                ({isPast(group.rsvp_deadline) ? 'encerrado' : relativeTime(group.rsvp_deadline)})
              </span>
            </Detail>
          )}
          {group.max_participants && <Detail label="👥 Limite">{group.max_participants} participantes</Detail>}
          {group.theme && <Detail label="🎨 Tema">{group.theme}</Detail>}
          {group.dress_code && <Detail label="👔 Traje">{group.dress_code}</Detail>}
          {group.drawn_at && <Detail label="🎲 Sorteado em">{formatShort(group.drawn_at)}</Detail>}
        </dl>
        {group.gift_ideas && (
          <div className="block">
            <h3>🎁 Presentes desejados / sugestões</h3>
            <p className="pre">{group.gift_ideas}</p>
          </div>
        )}
        {group.notes && (
          <div className="block">
            <h3>📌 Observações e regras</h3>
            <p className="pre">{group.notes}</p>
          </div>
        )}
      </section>

      {/* ---------- Convite ---------- */}
      {isOpen && <InviteBox group={group} isOwner={isOwner} onRegenerated={load} />}

      {isOpen && !me && (
        <section className="card">
          <p>Você ainda não está participando do sorteio.</p>
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() =>
              run(() =>
                supabase.rpc('join_group', {
                  code: group.invite_code,
                  p_display_name: userDisplayName(user) || 'Organizador',
                  p_avatar_url: userAvatar(user),
                }),
              )
            }
          >
            Quero participar também
          </button>
        </section>
      )}

      {/* ---------- Participantes ---------- */}
      <section className="card" aria-labelledby="people-title">
        <div className="section-head">
          <h2 id="people-title">👥 Participantes ({participants.length})</h2>
          {isOwner && isOpen && (
            <button type="button" className="btn primary" onClick={() => setDialog('draw')} disabled={!canDraw}>
              🎲 Fazer sorteio
            </button>
          )}
          {isOwner && !isOpen && (
            <button type="button" className="btn ghost small" onClick={() => setDialog('reset')}>
              Refazer sorteio
            </button>
          )}
        </div>
        {isOwner && isOpen && !canDraw && (
          <p className="hint">São necessários pelo menos 3 participantes para sortear.</p>
        )}
        {participants.length === 0 ? (
          <p className="muted">Ninguém entrou ainda. Envie o link de convite!</p>
        ) : (
          <ul className="people">
            {participants.map((p) => {
              const isMe = p.id === me?.id;
              return (
                <li key={p.id}>
                  <Avatar name={p.display_name} url={p.avatar_url} size={40} />
                  {isMe && editingName ? (
                    <form className="inline-rename" onSubmit={(e) => saveMyName(e, p.id)}>
                      <label htmlFor="my-display-name" className="visually-hidden">
                        Seu nome no grupo
                      </label>
                      <input
                        id="my-display-name"
                        name="display_name"
                        required
                        maxLength={60}
                        defaultValue={p.display_name}
                        autoFocus
                      />
                      <button type="submit" className="btn primary small" disabled={busy}>
                        Salvar
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => setEditingName(false)}>
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="person-name">
                        {p.display_name}
                        {p.user_id === group.owner_id && <span className="badge owner">organizador</span>}
                        {isMe && <span className="badge">você</span>}
                      </span>
                      <span className="muted small">{itemsOf(p.id).length} desejo(s)</span>
                      {isMe && (
                        <button type="button" className="btn ghost small" onClick={() => setEditingName(true)}>
                          Renomear
                        </button>
                      )}
                      {isOwner && isOpen && !isMe && (
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => setDialog({ remove: p })}
                          aria-label={`Remover ${p.display_name}`}
                        >
                          Remover
                        </button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- Listas de desejos ---------- */}
      {me && (
        <section className="card" aria-labelledby="mywish-title">
          <h2 id="mywish-title">📝 Minha lista de desejos</h2>
          <p className="hint">Ajude quem te tirou: adicione ideias de presentes e links de produtos.</p>
          <WishlistEditor items={itemsOf(me.id)} participantId={me.id} groupId={id} onChange={load} />
        </section>
      )}

      {others.length > 0 && (
        <section className="card" aria-labelledby="allwish-title">
          <h2 id="allwish-title">🎀 Listas de desejos do grupo</h2>
          {others.map((p) => (
            <details key={p.id} className="wish-details">
              <summary>
                <Avatar name={p.display_name} url={p.avatar_url} size={28} /> {p.display_name}{' '}
                <span className="muted small">({itemsOf(p.id).length})</span>
              </summary>
              <WishlistView items={itemsOf(p.id)} />
            </details>
          ))}
        </section>
      )}

      {/* ---------- Zona de perigo ---------- */}
      <section className="danger-zone">
        {me && isOpen && (
          <button type="button" className="btn ghost danger-text" onClick={() => setDialog('leave')}>
            Sair deste amigo secreto
          </button>
        )}
        {isOwner && (
          <button type="button" className="btn ghost danger-text" onClick={() => setDialog('delete')}>
            Excluir amigo secreto
          </button>
        )}
      </section>

      {/* ---------- Diálogos ---------- */}
      <ConfirmDialog
        open={dialog === 'draw'}
        title="Fazer o sorteio agora?"
        confirmLabel="🎲 Sortear"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => supabase.rpc('draw_group', { gid: id }))}
      >
        <p>
          Serão sorteados os <strong>{participants.length} participantes</strong> atuais. Depois disso ninguém mais
          poderá entrar. Cada pessoa verá apenas quem ela tirou — nem você verá os pares.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'reset'}
        title="Refazer o sorteio?"
        confirmLabel="Desfazer sorteio"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => supabase.rpc('reset_draw', { gid: id }))}
      >
        <p>
          O resultado atual e <strong>todas as mensagens</strong> serão apagados e as inscrições reabrem. Avise o grupo
          de que haverá um novo sorteio!
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'leave'}
        title="Sair deste amigo secreto?"
        confirmLabel="Sair"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(
            () => supabase.from('participants').delete().eq('id', me!.id),
            () => (isOwner ? load() : navigate('/')),
          )
        }
      >
        <p>
          Sua lista de desejos será apagada. Você pode entrar de novo pelo link enquanto as inscrições estiverem
          abertas.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        title="Excluir este amigo secreto?"
        confirmLabel="Excluir para sempre"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(
            () => supabase.from('groups').delete().eq('id', id),
            () => navigate('/'),
          )
        }
      >
        <p>Todos os participantes, listas, sorteio e mensagens serão apagados. Esta ação não pode ser desfeita.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={typeof dialog === 'object' && dialog !== null}
        title={`Remover ${typeof dialog === 'object' && dialog ? dialog.remove.display_name : ''}?`}
        confirmLabel="Remover"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (typeof dialog === 'object' && dialog) {
            const pid = dialog.remove.id;
            run(() => supabase.from('participants').delete().eq('id', pid));
          }
        }}
      >
        <p>A pessoa sai do grupo e a lista de desejos dela é apagada.</p>
      </ConfirmDialog>
    </article>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
