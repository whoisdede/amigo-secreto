import type { Group } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const timeOnly = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export const money = (v: number) => brl.format(Number(v));

export function valueRange(min: number | null, max: number | null): string | null {
  const lo = min != null ? Number(min) : null;
  const hi = max != null ? Number(max) : null;
  if (lo != null && hi != null) return lo === hi ? money(lo) : `${money(lo)} a ${money(hi)}`;
  if (lo != null) return `A partir de ${money(lo)}`;
  if (hi != null) return `Até ${money(hi)}`;
  return null;
}

export const formatDateTime = (iso: string) => fullDate.format(new Date(iso));
export const formatShort = (iso: string) => shortDate.format(new Date(iso));
export const formatTime = (iso: string) => timeOnly.format(new Date(iso));

export const isPast = (iso: string | null) => iso != null && new Date(iso).getTime() < Date.now();

/** "em 3 dias", "há 2 horas"... */
export function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  return rtf.format(Math.round(diffMs / day), 'day');
}

/** ISO -> valor aceito por <input type="datetime-local"> (no fuso local). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> -> ISO (ou null). */
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Usa /?convite=CODIGO para responder HTTP 200 no GitHub Pages
 * (assim o WhatsApp/Telegram exibe a prévia do link corretamente).
 * A rota /convite/:code também continua funcionando normalmente.
 */
export function inviteUrl(code: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('convite', code);
  return url.href;
}

export function whatsappShareUrl(opts: {
  name: string;
  url: string;
  eventAt?: string | null;
  range?: string | null;
  rsvpDeadline?: string | null;
}): string {
  const lines = [`🎁 Você foi convidado(a) para o amigo secreto *${opts.name}*!`];
  if (opts.eventAt) lines.push(`📅 Data: ${formatShort(opts.eventAt)}`);
  if (opts.range) lines.push(`💰 Presente: ${opts.range}`);
  if (opts.rsvpDeadline && !isPast(opts.rsvpDeadline)) {
    lines.push(`⏰ Confirme até: ${formatShort(opts.rsvpDeadline)}`);
  }
  lines.push('', 'Entre pelo link para confirmar sua presença:', opts.url);
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

const toCalStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function calendarSummary(group: Group): { start: Date; end: Date; details: string; location: string } | null {
  if (!group.event_at) return null;
  const start = new Date(group.event_at);
  const end = new Date(start.getTime() + 3 * 3_600_000);
  const range = valueRange(group.min_value, group.max_value);
  const lines: string[] = [];
  if (group.description) lines.push(group.description);
  if (range) lines.push(`Valor do presente: ${range}`);
  if (group.theme) lines.push(`Tema: ${group.theme}`);
  if (group.dress_code) lines.push(`Traje: ${group.dress_code}`);
  if (group.location_url) lines.push(`Mapa: ${group.location_url}`);
  return {
    start,
    end,
    details: lines.join('\n'),
    location: group.location ?? group.location_url ?? '',
  };
}

export function googleCalendarUrl(group: Group): string | null {
  const info = calendarSummary(group);
  if (!info) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🎁 ${group.name}`,
    dates: `${toCalStamp(info.start)}/${toCalStamp(info.end)}`,
    details: info.details,
    location: info.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(group: Group): void {
  const info = calendarSummary(group);
  if (!info) return;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amigo Secreto//PT-BR',
    'BEGIN:VEVENT',
    `UID:${group.id}@amigo-secreto`,
    `DTSTAMP:${toCalStamp(new Date())}`,
    `DTSTART:${toCalStamp(info.start)}`,
    `DTEND:${toCalStamp(info.end)}`,
    `SUMMARY:${esc(`🎁 ${group.name}`)}`,
    info.location ? `LOCATION:${esc(info.location)}` : '',
    info.details ? `DESCRIPTION:${esc(info.details)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${group.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'amigo-secreto'}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
