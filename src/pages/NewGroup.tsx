import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, userAvatar, userDisplayName } from '../lib/auth';
import { errorMessage, supabase } from '../lib/supabase';
import type { GroupInput } from '../lib/types';
import { GroupForm } from '../components/GroupForm';

export function NewGroup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function create(values: GroupInput, { participate }: { participate: boolean }) {
    setError(null);
    const { data, error } = await supabase.from('groups').insert(values).select('id, invite_code').single();
    if (error || !data) {
      setError(errorMessage(error));
      return;
    }
    if (participate) {
      const { error: joinError } = await supabase.rpc('join_group', {
        code: data.invite_code,
        p_display_name: userDisplayName(user) || 'Organizador',
        p_avatar_url: userAvatar(user),
      });
      if (joinError) setError(errorMessage(joinError));
    }
    navigate(`/grupo/${data.id}`);
  }

  return (
    <section>
      <h1>Criar amigo secreto</h1>
      <p className="muted">Só o nome é obrigatório — você pode editar tudo depois.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <GroupForm submitLabel="Criar e gerar convite" showParticipate onSubmit={create} onCancel={() => navigate('/')} />
    </section>
  );
}
