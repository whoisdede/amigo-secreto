import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/** Diálogo de confirmação usando o <dialog> nativo (foco, Esc e backdrop gerenciados pelo navegador). */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useRef(`dlg-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    dlg.setAttribute('closedby', 'any');
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Fallback para navegadores sem suporte a <dialog closedby="any"> (ex.: Safari)
  function handleBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (supportsClosedBy || e.detail === 0) return;
    const dlg = e.currentTarget;
    const r = dlg.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) dlg.close();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={handleBackdropClick}
      onClose={(e) => {
        const dlg = e.currentTarget;
        const choice = dlg.returnValue;
        dlg.returnValue = '';
        if (choice === 'confirm') onConfirm();
        onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children && <div className="dialog-body">{children}</div>}
      <form method="dialog" className="actions end">
        <button value="cancel" className="btn ghost" autoFocus>
          Cancelar
        </button>
        <button value="confirm" className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy}>
          {confirmLabel}
        </button>
      </form>
    </dialog>
  );
}
