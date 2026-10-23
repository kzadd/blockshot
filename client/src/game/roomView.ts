/** What the HUD and menus show about the current room. */
export interface RoomView {
  name: string;
  map: string;
  size: string;
  players: number;
  max: number;
}
