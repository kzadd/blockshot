import type { MapId } from '@blockshot/shared';

/** Aerial screenshot of a map (client/public/maps), used for cards and the blurred menu background. */
export const mapImage = (id: MapId): string => `${import.meta.env.BASE_URL}maps/${id}.jpg`;
