precision highp float;

uniform vec2 uResolution;
uniform sampler2D uVideoTexture;
uniform sampler2D uPosterTexture;
uniform float uVideoReady;
uniform float uTime;
uniform float uSurfaceY;
uniform float uLevel;
uniform float uWaveAmplitude;
uniform float uHit;
varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float surfaceWave(float x) {
  float wave = sin(x * 12.0 + uTime * 5.1) * 0.48;
  wave += sin(x * 21.0 - uTime * 3.8 + 1.4) * 0.32;
  wave += sin(x * 34.0 + uTime * 6.2 + 4.0) * 0.20;
  return wave * uWaveAmplitude;
}

void main() {
  vec2 screenUv = vUv;
  float fillTopY = clamp(uSurfaceY, 0.0, 1.0);
  float surfaceY = fillTopY + surfaceWave(screenUv.x);
  float hasBeer = step(0.004, uLevel);
  float beerMask = hasBeer * (1.0 - smoothstep(surfaceY - 0.002, surfaceY + 0.005, screenUv.y));

  // Keep the photographed carbonation fixed in screen space. Filling reveals
  // more of the plate without stretching bubbles or changing their spacing.
  vec2 videoUv = screenUv;

  // The viewport is the inside of the glass. Refraction is confined to the
  // outermost edge so no glass silhouette or base can appear in the picture.
  float centeredX = videoUv.x - 0.5;
  float edge = abs(centeredX) * 2.0;
  float glassEdge = pow(smoothstep(0.82, 1.0, edge), 1.7);
  float glassRipple = sin(videoUv.y * 31.0 + sin(videoUv.y * 7.0) * 1.4) * 0.00065;
  videoUv.x += sign(centeredX) * glassEdge * (0.0032 + glassRipple);
  videoUv.y += sin(videoUv.y * 23.0 + edge * 5.0) * glassEdge * 0.00045;

  float disturbanceRange = max(fillTopY * 0.18, 0.035);
  float surfaceInfluence = smoothstep(surfaceY - disturbanceRange, surfaceY, screenUv.y) * beerMask * uHit;
  videoUv.x += (sin(screenUv.y * 24.0 + uTime * 5.0) + sin(screenUv.x * 18.0 - uTime * 3.7))
    * surfaceInfluence * uWaveAmplitude * 0.30;
  videoUv.y += sin(screenUv.x * 17.0 + uTime * 4.2) * surfaceInfluence * uWaveAmplitude * 0.10;
  videoUv = clamp(videoUv, vec2(0.001), vec2(0.999));

  vec3 poster = texture2D(uPosterTexture, videoUv).rgb;
  vec3 moving = texture2D(uVideoTexture, videoUv).rgb;
  vec3 beer = mix(poster, moving, smoothstep(0.0, 1.0, uVideoReady));

  // Preserve the photographed grade; only subtle glass falloff and grain remain.
  float edgeShade = pow(smoothstep(0.78, 1.0, edge), 1.65);
  beer *= mix(vec3(1.0), vec3(0.90, 0.92, 0.94), edgeShade * 0.28);
  float grain = hash21(gl_FragCoord.xy + floor(uTime * 10.0)) - 0.5;
  beer += grain * 0.0025;
  beer = max(beer, vec3(0.0));

  gl_FragColor = vec4(mix(vec3(0.004, 0.002, 0.001), beer, beerMask), 1.0);
}
