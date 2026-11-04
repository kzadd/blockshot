import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import '../styles/proposal.css';
import '../styles/pz-extra.css';

interface Props {
  onClose: () => void;
  labelledBy: string;
  /** `wide` for the controls list */
  className?: string;
  /** the form's submit (Enter or the primary button); without it a submit closes the dialog */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

// The proposal's modal (<dialog class="modal"><form method="dialog">). It must sit inside a `.pz` root, which
// styles it. Native modal: Esc, focus trap and the top layer come from the browser; a click on the backdrop closes it.
export default function Modal({ onClose, labelledBy, className = '', onSubmit, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        // The dialog's own padding is the dialog too: only a click outside its box is the backdrop
        const r = e.currentTarget.getBoundingClientRect();
        const out = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (e.target === e.currentTarget && out) onClose();
      }}
    >
      <form method="dialog" onSubmit={onSubmit}>
        {children}
      </form>
    </dialog>
  );
}
