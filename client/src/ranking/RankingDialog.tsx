// In game: the same ranking screen as the lobby tab, as a window over the game (closes with Esc or Cerrar).
import { useEffect } from 'react';
import { RankingScreen } from './RankingScreen';

/** The nickname the lobby saved: the ranking is by name. */
const savedNick = () => {
  try {
    return localStorage.getItem('blockshot:nick') ?? '';
  } catch {
    return '';
  }
};

export default function RankingDialog({
  admin,
  onClose,
  you = savedNick(),
}: {
  admin: boolean;
  onClose: () => void;
  /** your name in the ranking (defaults to the nickname saved in the lobby) */
  you?: string;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="pz rk-window" role="dialog" aria-modal="true" aria-label="Ranking">
      <RankingScreen you={you} admin={admin} onClose={onClose} />
    </div>
  );
}
