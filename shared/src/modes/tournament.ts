// League tournament: points per place in each round (from 1st down); everyone else who played gets 1.
export const TOUR_POINTS = [10, 8, 6, 5, 4, 3, 2];
/** Rounds the admin can choose. */
export const TOUR_ROUNDS = [3, 5, 7] as const;

/** Standings after a round, shown on the results screen. */
export interface TournamentResult {
  round: number;
  rounds: number;
  /** the last round: rows[0] is the champion */
  final: boolean;
  rows: { name: string; pts: number; wins: number; gained: number }[];
}
