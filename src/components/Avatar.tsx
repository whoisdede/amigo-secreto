import { initials } from '../lib/format';

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        className="avatar"
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    );
  }
  return (
    <span className="avatar fallback" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name) || '?'}
    </span>
  );
}
