import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { errorMessage, supabase } from '../lib/supabase';
import { formatShort } from '../lib/format';
import type { Group } from '../lib/types';
import { LoginButton } from '../components/LoginButton';
import { Spinner } from '../components/Layout';

type GroupRow = Pick<Group, 'id' | 'name' | 'event_at' | 'status' | 'owner_id'> & {
  participantCount: number;
};

export function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <MyGroups userId={user.id} /> : <Landing />;
}

function Landing() {
  return (
    <section className="hero">
      <div className="hero-emoji" aria-hidden="true">
        🎄🎁🤫
      </div>
      <h1>Organize seu amigo secreto online</h1>
      <p className="lead">
        Crie o grupo, defina valores, data e local, envie o link de convite e deixe o sorteio com a gente. Ninguém — nem
        o organizador — descobre quem tirou quem.
      </p>
      <LoginButton defaultMode="signup" />
      <ul className="features">
        <li>
          <strong>🔗 Convite por link</strong>
          <span>Mande no WhatsApp e cada um confirma presença.</span>
        </li>
        <li>
          <strong>💰 Valores e regras</strong>
          <span>Mínimo, máximo, tema, traje e observações.</span>
        </li>
        <li>
          <strong>📝 Lista de desejos</strong>
          <span>Cada participante diz o que quer ganhar.</span>
        </li>
        <li>
          <strong>💬 Mensagens anônimas</strong>
          <span>Converse com seu amigo secreto sem se revelar.</span>
        </li>
      </ul>
    </section>
  );
}

function MyGroups({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('groups').select('id, name, event_at, status, owner_id').order('created_at', { ascending: false }),
      supabase.from('participants').select('group_id'),
    ]).then(([gRes, pRes]) => {
      const err = gRes.error ?? pRes.error;
      if (err) {
        setError(errorMessage(err));
        return;
      }
      const counts = new Map<string, number>();
      for (const p of pRes.data ?? []) {
        counts.set(p.group_id, (counts.get(p.group_id) ?? 0) + 1);
      }
      setGroups(
        (gRes.data ?? []).map((g) => ({
          ...g,
          participantCount: counts.get(g.id) ?? 0,
        })),
      );
    });
  }, []);

  return (
    <section>
      <div className="page-head">
        <h1>Meus amigos secretos</h1>
        <Link to="/novo" className="btn primary">
          + Criar amigo secreto
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!groups && !error && <Spinner />}
      {groups?.length === 0 && (
        <div className="card empty-state">
          <p className="hero-emoji" aria-hidden="true">
            🎁
          </p>
          <p>Você ainda não participa de nenhum amigo secreto.</p>
          <p className="muted">Crie um novo ou peça o link de convite para o organizador.</p>
        </div>
      )}
      <ul className="group-grid">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link to={`/grupo/${g.id}`} className="card group-card">
              <h2>{g.name}</h2>
              <p className="muted">{g.event_at ? `📅 ${formatShort(g.event_at)}` : 'Data a definir'}</p>
              <div className="tags">
                <span className={`badge ${g.status}`}>{g.status === 'drawn' ? 'Sorteado' : 'Aberto'}</span>
                <span className="badge">👥 {g.participantCount}</span>
                {g.owner_id === userId && <span className="badge owner">Organizador</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
