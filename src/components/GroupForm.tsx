import { useState, type FormEvent } from 'react';
import type { GroupInput } from '../lib/types';
import { fromLocalInput, toLocalInput } from '../lib/format';

interface Props {
  initial?: Partial<GroupInput>;
  submitLabel: string;
  /** Mostra a opção "eu também vou participar" (apenas na criação). */
  showParticipate?: boolean;
  onSubmit: (values: GroupInput, opts: { participate: boolean }) => Promise<void>;
  onCancel?: () => void;
}

const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const num = (fd: FormData, k: string) => {
  const v = text(fd, k);
  return v == null ? null : Number(v.replace(',', '.'));
};

export function GroupForm({ initial = {}, submitLabel, showParticipate, onSubmit, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const values: GroupInput = {
      name: text(fd, 'name') ?? '',
      description: text(fd, 'description'),
      event_at: fromLocalInput(String(fd.get('event_at') ?? '')),
      location: text(fd, 'location'),
      location_url: text(fd, 'location_url'),
      min_value: num(fd, 'min_value'),
      max_value: num(fd, 'max_value'),
      gift_ideas: text(fd, 'gift_ideas'),
      theme: text(fd, 'theme'),
      dress_code: text(fd, 'dress_code'),
      notes: text(fd, 'notes'),
      rsvp_deadline: fromLocalInput(String(fd.get('rsvp_deadline') ?? '')),
      max_participants: num(fd, 'max_participants'),
    };

    // Validações que dependem de mais de um campo
    const maxInput = form.elements.namedItem('max_value') as HTMLInputElement;
    const rsvpInput = form.elements.namedItem('rsvp_deadline') as HTMLInputElement;
    maxInput.setCustomValidity(
      values.min_value != null && values.max_value != null && values.max_value < values.min_value
        ? 'O valor máximo deve ser maior ou igual ao mínimo.'
        : '',
    );
    rsvpInput.setCustomValidity(
      values.rsvp_deadline && values.event_at && values.rsvp_deadline > values.event_at
        ? 'O prazo de confirmação deve ser antes da data do evento.'
        : '',
    );
    if (!form.reportValidity()) return;

    setBusy(true);
    try {
      await onSubmit(values, { participate: fd.get('participate') === 'on' });
    } finally {
      setBusy(false);
    }
  }

  // Limpa erros customizados assim que o usuário corrige o campo
  const clearCustom = (e: FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'max_value' || t.name === 'min_value') {
      (e.currentTarget.elements.namedItem('max_value') as HTMLInputElement).setCustomValidity('');
    }
    if (t.name === 'rsvp_deadline' || t.name === 'event_at') {
      (e.currentTarget.elements.namedItem('rsvp_deadline') as HTMLInputElement).setCustomValidity('');
    }
  };

  return (
    <form className="group-form" onSubmit={handleSubmit} onInput={clearCustom}>
      <fieldset className="card">
        <legend>📝 Informações básicas</legend>
        <div className="field">
          <label htmlFor="name">
            Nome do amigo secreto <span className="req">(obrigatório)</span>
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={120}
            defaultValue={initial.name ?? ''}
            placeholder="Ex.: Amigo secreto da família 2026"
            enterKeyHint="next"
          />
          <p className="error-msg">Dê um nome para o seu amigo secreto.</p>
        </div>
        <div className="field">
          <label htmlFor="description">Descrição / mensagem para os convidados</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={initial.description ?? ''}
            placeholder="Ex.: Vamos celebrar o fim de ano juntos!"
          />
        </div>
      </fieldset>

      <fieldset className="card">
        <legend>📅 Data e local</legend>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="event_at">Data e hora da troca</label>
            <input id="event_at" name="event_at" type="datetime-local" defaultValue={toLocalInput(initial.event_at ?? null)} />
          </div>
          <div className="field">
            <label htmlFor="location">Local</label>
            <input
              id="location"
              name="location"
              maxLength={300}
              defaultValue={initial.location ?? ''}
              placeholder="Ex.: Casa da vó, Rua das Flores, 123"
              autoComplete="street-address"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="location_url">Link do mapa</label>
          <span id="location_url-hint" className="hint">
            Cole o link do Google Maps / Waze (começa com https://)
          </span>
          <input
            id="location_url"
            name="location_url"
            type="url"
            pattern="https?://.+"
            defaultValue={initial.location_url ?? ''}
            placeholder="https://maps.app.goo.gl/…"
            aria-describedby="location_url-hint"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <p className="error-msg">Informe um link válido começando com https://</p>
        </div>
      </fieldset>

      <fieldset className="card">
        <legend>🎁 Presentes</legend>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="min_value">Valor mínimo (R$)</label>
            <input
              id="min_value"
              name="min_value"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={initial.min_value ?? ''}
              placeholder="50,00"
            />
            <p className="error-msg">Informe um valor válido.</p>
          </div>
          <div className="field">
            <label htmlFor="max_value">Valor máximo (R$)</label>
            <input
              id="max_value"
              name="max_value"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={initial.max_value ?? ''}
              placeholder="100,00"
            />
            <p className="error-msg">O máximo deve ser maior ou igual ao mínimo.</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="gift_ideas">Presentes desejados / sugestões gerais</label>
          <span id="gift_ideas-hint" className="hint">
            Categorias ou ideias para todos (cada participante também terá a própria lista de desejos)
          </span>
          <textarea
            id="gift_ideas"
            name="gift_ideas"
            rows={3}
            maxLength={2000}
            defaultValue={initial.gift_ideas ?? ''}
            placeholder="Ex.: livros, chocolates, itens de decoração, nada de roupas…"
            aria-describedby="gift_ideas-hint"
          />
        </div>
      </fieldset>

      <fieldset className="card">
        <legend>✅ Participação</legend>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="rsvp_deadline">Prazo para confirmar participação</label>
            <input
              id="rsvp_deadline"
              name="rsvp_deadline"
              type="datetime-local"
              defaultValue={toLocalInput(initial.rsvp_deadline ?? null)}
            />
            <p className="error-msg">O prazo deve ser antes da data do evento.</p>
          </div>
          <div className="field">
            <label htmlFor="max_participants">Limite de participantes</label>
            <input
              id="max_participants"
              name="max_participants"
              type="number"
              inputMode="numeric"
              min={3}
              step={1}
              defaultValue={initial.max_participants ?? ''}
              placeholder="Sem limite"
            />
            <p className="error-msg">O mínimo é 3 participantes.</p>
          </div>
        </div>
        {showParticipate && (
          <label className="check">
            <input type="checkbox" name="participate" defaultChecked />
            Eu também vou participar do sorteio
          </label>
        )}
      </fieldset>

      <fieldset className="card">
        <legend>✨ Extras</legend>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="theme">Tema</label>
            <input
              id="theme"
              name="theme"
              maxLength={200}
              defaultValue={initial.theme ?? ''}
              placeholder="Ex.: presentes feitos à mão"
            />
          </div>
          <div className="field">
            <label htmlFor="dress_code">Traje / código de vestimenta</label>
            <input
              id="dress_code"
              name="dress_code"
              maxLength={200}
              defaultValue={initial.dress_code ?? ''}
              placeholder="Ex.: suéter natalino, branco…"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">Observações e regras</label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={4000}
            defaultValue={initial.notes ?? ''}
            placeholder="Ex.: cada um leva um prato; o presente deve vir embrulhado; haverá amigo da onça…"
          />
        </div>
      </fieldset>

      <div className="actions end">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
