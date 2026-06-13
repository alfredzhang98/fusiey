import { patternsApi } from '../services/api';
import { usePatternStore } from '../store/usePatternStore';

/**
 * Fetch a saved pattern and load it into the designer canvas.
 * The store id matches the server id, so subsequent saves PATCH in place.
 */
export async function loadSavedPattern(id: string): Promise<void> {
  const { pattern } = await patternsApi.get(id);
  usePatternStore.getState().setPattern({
    id: pattern.id,
    name: pattern.name,
    width: pattern.width,
    height: pattern.height,
    grid: pattern.grid,
    paletteId: pattern.paletteId,
    beadSize: pattern.beadSize,
  });
}
