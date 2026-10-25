// Practice bot levels (server PC only): how well they aim and how long they take to react.
export type BotLevel = 'easy' | 'normal' | 'hard';

export const BOT_LEVELS: Record<BotLevel, { name: string; aimError: number; reactionMs: number }> = {
  easy: { name: 'Fácil', aimError: 0.06, reactionMs: 750 },
  normal: { name: 'Normal', aimError: 0.035, reactionMs: 450 },
  hard: { name: 'Difícil', aimError: 0.018, reactionMs: 250 },
};
export const isBotLevel = (v: unknown): v is BotLevel => typeof v === 'string' && Object.hasOwn(BOT_LEVELS, v);
