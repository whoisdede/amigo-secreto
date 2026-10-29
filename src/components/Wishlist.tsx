import { useState, type FormEvent } from 'react';
import { errorMessage, supabase } from '../lib/supabase';
import type { WishlistItem } from '../lib/types';

function ItemList({
  items,
  editingId,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
}: {
  items: WishlistItem[];
  editingId?: string | null;
  onEdit?: (item: WishlistItem) => void;
  onSaveEdit?: (id: string, data: { title: string; url: string | null; notes: string | null }) => Promise<void>;
  onCancelEdit?: () => void;
  onRemove?: (item: WishlistItem) => void;
}) {
  if (items.length === 0) return <p className="muted">Nenhum item na lista ainda.</p>;
  return (
    <ul className="wishlist">
      {items.map((item) =>
        editingId === item.id && onSaveEdit ? (
          <li key={item.id} className="wish-editing">
            <EditItemForm item={item} onSave={(data) => onSaveEdit(item.id, data)} onCancel={() => onCancelEdit?.()} />
          </li>
        ) : (
          <li key={item.id}>
            <div className="wish-main">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <strong>{item.title}</strong>
              )}
              {item.notes && <p className="muted small">{item.notes}</p>}
            </div>
            {(onEdit || onRemove) && (
              <div className="wish-actions">
                {onEdit && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => onEdit(item)}
                    aria-label={`Editar ${item.title}`}
                  >
                    Editar
                  </button>
                )}
                {onRemove && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => onRemove(item)}
                    aria-label={`Remover ${item.title}`}
                  >
                    Remover
                  </button>
                )}
              </div>
            )}
          </li>
        ),
      )}
    </ul>
  );
}

function EditItemForm({
  item,
  onSave,
  onCancel,
}: {
  item: WishlistItem;
  onSave: (data: { title: string; url: string | null; notes: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const url = String(fd.get('url') ?? '').trim();
    const notes = String(fd.get('notes') ?? '').trim();
    setBusy(true);
    try {
      await onSave({
        title: String(fd.get('title')).trim(),
        url: url || null,
        notes: notes || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="wish-edit-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`edit-title-${item.id}`}>Presente</label>
        <input id={`edit-title-${item.id}`} name="title" required maxLength={200} defaultValue={item.title} autoFocus />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`edit-url-${item.id}`}>Link do produto</label>
          <input
            id={`edit-url-${item.id}`}
            name="url"
            type="url"
            pattern="https?://.+"
            defaultValue={item.url ?? ''}
            placeholder="https://…"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <p className="error-msg">O link deve começar com https://</p>
        </div>
        <div className="field">
          <label htmlFor={`edit-notes-${item.id}`}>Detalhes</label>
          <input id={`edit-notes-${item.id}`} name="notes" maxLength={500} defaultValue={item.notes ?? ''} />
        </div>
      </div>
      <div className="actions end">
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn primary small" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

/** Somente leitura (lista de outra pessoa). */
export function WishlistView({ items }: { items: WishlistItem[] }) {
  return <ItemList items={items} />;
}

/** Editor da minha lista de desejos. */
export function WishlistEditor({
  items,
  participantId,
  groupId,
  onChange,
}: {
  items: WishlistItem[];
  participantId: string;
  groupId: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const url = String(fd.get('url') ?? '').trim();
    const notes = String(fd.get('notes') ?? '').trim();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('wishlist_items').insert({
      participant_id: participantId,
      group_id: groupId,
      title: String(fd.get('title')).trim(),
      url: url || null,
      notes: notes || null,
    });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    form.reset();
    (form.elements.namedItem('title') as HTMLInputElement).focus();
    onChange();
  }

  async function saveEdit(id: string, data: { title: string; url: string | null; notes: string | null }) {
    setError(null);
    const { error } = await supabase.from('wishlist_items').update(data).eq('id', id);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setEditingId(null);
    onChange();
  }

  async function remove(item: WishlistItem) {
    const { error } = await supabase.from('wishlist_items').delete().eq('id', item.id);
    if (error) setError(errorMessage(error));
    else onChange();
  }

  return (
    <div>
      <ItemList
        items={items}
        editingId={editingId}
        onEdit={(item) => setEditingId(item.id)}
        onSaveEdit={saveEdit}
        onCancelEdit={() => setEditingId(null)}
        onRemove={remove}
      />
      <form className="wish-form" onSubmit={add}>
        <div className="field">
          <label htmlFor="wish-title">O que você gostaria de ganhar?</label>
          <input id="wish-title" name="title" required maxLength={200} placeholder="Ex.: Livro “O Pequeno Príncipe”" />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="wish-url">Link do produto (opcional)</label>
            <input
              id="wish-url"
              name="url"
              type="url"
              pattern="https?://.+"
              placeholder="https://…"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <p className="error-msg">O link deve começar com https://</p>
          </div>
          <div className="field">
            <label htmlFor="wish-notes">Detalhes (tamanho, cor…)</label>
            <input id="wish-notes" name="notes" maxLength={500} placeholder="Ex.: tamanho M, cor azul" />
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions end">
          <button type="submit" className="btn secondary" disabled={busy}>
            {busy ? 'Adicionando…' : '+ Adicionar à lista'}
          </button>
        </div>
      </form>
    </div>
  );
}
