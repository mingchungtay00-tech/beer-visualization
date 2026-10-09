export const DISPLAY_CONFIG = {
  // Keep a small white foam cap visible at full; the beer body fills behind it.
  surface: { minY: 0.98, maxY: 0.025, totalSteps: 100, animationMs: 420, hiddenY: 1.2 },
  // GIF foam line is about 27% down the source. Values are viewport-height units.
  foam: { sourceOffsetY: -13, bandHeight: 29, bandOffsetY: -14 },
  ending: { durationMs: 900, fullHoldMs: 550 },
};
