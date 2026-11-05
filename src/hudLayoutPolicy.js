/** Browser-free layout vocabulary shared by UI and server-side voice tools. */
export const INSTRUMENT_HUD_LAYOUTS = Object.freeze([
  'aperture',
  'survey',
  'signal',
]);
export const HUD_LAYOUTS = Object.freeze([
  'tactical',
  'minimal',
  'cyber',
  ...INSTRUMENT_HUD_LAYOUTS,
]);

/** Optical layouts remain selected when the imagery filter changes. */
export function isInstrumentHudLayout(layout) {
  return INSTRUMENT_HUD_LAYOUTS.includes(layout);
}
