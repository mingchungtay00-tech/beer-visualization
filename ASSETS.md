# Kirin Beer flow

The shared background stays mounted throughout the experience:

1. Opening artwork over `kirin-background.png`.
2. First tap / A enters the beer screen at zero hits. The GIF rises from below the screen.
3. Another 100 taps / A fill the beer. The central percentage is based on these 100 fill hits (101 hits total, including the first hit that starts the experience).
4. After the final rise, hold 100% for 550 ms, then dim the beer and reveal MBOR above the Kirin final logo. A small foam cap remains visible, with the beer body covering the paper behind it.

R returns to the opening and cancels pending completion. P toggles calibration. Extra hits during completion or the final screen are ignored. Repeated held keys do not count.

## Assets

Original inputs were supplied in Downloads. Original files remain untouched.

| App asset in `public/images` | Source |
| --- | --- |
| `kirin-background.png` | `KirinBeer_Background.png`, unchanged |
| `kirin-final-logo.png` | `KirinBeer_FinalLogo.png`, unchanged, existing alpha |
| `mbor-final.png` | `MBOR.png`, unchanged, existing alpha |
| `clientbeer.webp` | WebP conversion of `clientbeer.gif` at quality 90, preserving dimensions, transparency, and the 7-second loop; encoder combines duplicate frames into 169 frames |
| `kirin-opening-cutout.png` | Built-in imagegen background extraction from `KirinBeer_Opening.png` |

Layout reference: `KirinBeer_Progress.jpg`. The opening cutout has a verified RGBA alpha range of 0–255. It is AI edited; keep the supplied original as the source of truth for brand artwork. No MP4 is requested by the app. The original GIF is approximately 203 MB and is retained locally but excluded from Vercel uploads to meet its 100 MB per-file limit. The app serves the compressed animated WebP instead.

Final built-in imagegen prompt:

> Remove background from this image. Output a PNG with an actual transparent ALPHA CHANNEL. The beige paper and gold wave pattern are the background; remove them. Preserve the foreground red disk, OKTOBER FEST lettering, gold fans and clouds, mugs and hands with white outlines exactly. Critical: actual transparency, NOT a drawn checkerboard. No checkerboard pixels, no white background. Do not change foreground design.

Surface range, 100-hit fill target, animation duration and completion hold are configured in `src/config.js`. CSS handles the persistent background, percentage artwork and staggered final logo reveal.
