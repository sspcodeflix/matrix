import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Dialog.module.css';

/**
 * Modal dialog on the native <dialog> element: focus stays inside, Escape closes,
 * and focus returns to the opener on close.
 */
export function Dialog({ open, onClose, title, subtitle, footer, children, width = 960 }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ maxWidth: `min(${width}px, calc(100vw - 32px))` }}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.frame}>
          <header className={styles.head}>
            <div className="stack" style={{ '--gap': '2px' } as CSSProperties}>
              <h2 id={titleId} style={{ fontSize: 18 }}>{title}</h2>
              {subtitle && <span className="small muted">{subtitle}</span>}
            </div>
            <button type="button" className="btn icon" aria-label="Close dialog" onClick={onClose}>
              <Icon name="close" />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.foot}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
