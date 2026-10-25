// Quick chat: fixed phrases only (nothing to moderate in a classroom). In team modes the tactical ones only
// reach your team; `all` ones reach everybody.
export const QUICK_CHAT: { text: string; all: boolean }[] = [
  { text: '¡Vamos!', all: false },
  { text: 'Cúbreme', all: false },
  { text: 'Necesito ayuda', all: false },
  { text: 'Enemigo a la vista', all: false },
  { text: 'Defended la base', all: false },
  { text: '¡Buen tiro!', all: true },
  { text: '¡Gracias!', all: true },
  { text: 'Buena partida', all: true },
];

/** One phrase per player at most this often (ms). */
export const QUICK_CHAT_COOLDOWN_MS = 1500;
