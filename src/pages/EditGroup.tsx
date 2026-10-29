import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { errorMessage, supabase } from '../lib/supabase';
import type { Group, GroupInput } from '../lib/types';
import { GroupForm } from '../components/GroupForm';
import { Spinner } from '../components/Layout';

export function EditGroup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('groups')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error));
        setGroup(data as Group | null);
        setLoading(false);
      });
  }, [id]);

  async function save(values: GroupInput) {
    setError(null);
    const { error } = await supabase.from('groups').update(values).eq('id', id!);
    if (error) setError(errorMessage(error));
    else navigate(`/grupo/${id}`);
  }

  if (loading) return <Spinner />;
  if (!group || group.owner_id !== user?.id) {
    return (
      <div className="card empty-state">
        <p>Apenas o organizador pode editar este amigo secreto.</p>
        <Link to="/" className="btn ghost">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <section>
      <h1>Editar “{group.name}”</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <GroupForm initial={group} submitLabel="Salvar alterações" onSubmit={save} onCancel={() => navigate(`/grupo/${id}`)} />
    </section>
  );
}
