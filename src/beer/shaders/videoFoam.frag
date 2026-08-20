precision highp float;

uniform vec2 uResolution;
uniform sampler2D uVideoTexture;
uniform sampler2D uPosterTexture;
uniform float uVideoReady;
uniform float uTime;
uniform float uSurfaceY;
uniform float uFillTopY;
uniform float uLevel;
uniform float uWaveAmplitude;
uniform float uHit;
varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 31.37);
  return fract(p.x * p.y);
}

float smoothNoise1D(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash21(vec2(i, 7.0)), hash21(vec2(i + 1.0, 7.0)), f);
}

float surfaceWave(float x) {
  float wave = sin(x * 12.0 + uTime * 5.1) * 0.48;
  wave += sin(x * 21.0 - uTime * 3.8 + 1.4) * 0.32;
  wave += sin(x * 34.0 + uTime * 6.2 + 4.0) * 0.20;
  return wave * uWaveAmplitude;
}

void main() {
  float wave = surfaceWave(vUv.x);
  float hitMotion = smoothstep(0.01, 0.45, uHit);
  float foamShift = hitMotion * (
    sin(uTime * 6.4 + 0.8) * 0.0045
    + sin(uTime * 10.2 + 2.1) * 0.0018
  );
  float top = uFillTopY + wave * 0.34 + foamShift * 0.55;
  float bottom = uSurfaceY + wave + foamShift
    + (smoothNoise1D(vUv.x * 42.0) - 0.5) * 0.0022;
  float visibleFoam = step(0.004, uLevel);
  float foamMask = smoothstep(bottom - 0.004, bottom + 0.003, vUv.y)
    * (1.0 - smoothstep(top - 0.002, top + 0.004, vUv.y)) * visibleFoam;

  const float fixedFoamHeight = 0.106;
  float sampleY = clamp((vUv.y - bottom) / fixedFoamHeight, 0.0, 1.0);
  // Preserve the photographic pore scale. At low levels the visible band crops
  // the source instead of vertically squeezing the foam texture.
  float sourceAspect = 2160.0 / 456.0;
  float sourceSpan = clamp(
    sourceAspect * fixedFoamHeight * uResolution.y / max(uResolution.x, 1.0),
    0.22,
    0.92
  );
  float sourceY = 0.5 + (sampleY - 0.5) * sourceSpan;
  float foamScale = clamp((top - bottom) / fixedFoamHeight, 0.0, 1.0);
  sourceY += (1.0 - foamScale) * 0.42;
  sourceY += hitMotion * (
    sin(vUv.x * 8.0 + uTime * 7.0) * 0.020
    + sin(vUv.x * 15.0 - uTime * 4.6 + 1.7) * 0.009
  );
  sourceY = clamp(sourceY, 0.001, 0.999);
  float xDrift = hitMotion * (
    sin(uTime * 4.2 + sampleY * 2.0) * 0.021
    + sin(uTime * 2.5 + 2.3) * 0.009
  );
  float sampleX = clamp(vUv.x + xDrift, 0.001, 0.999);

  vec3 poster = texture2D(uPosterTexture, vec2(sampleX, sourceY)).rgb;
  vec3 videoColor = texture2D(uVideoTexture, vec2(sampleX, sourceY)).rgb;
  vec3 photographed = mix(poster, videoColor, uVideoReady * hitMotion);
  float luma = dot(photographed, vec3(0.299, 0.587, 0.114));

  vec3 creamBody = vec3(0.965, 0.935, 0.86);
  vec3 foam = mix(photographed * vec3(1.025, 1.01, 0.965), creamBody, 0.10);
  foam = (foam - 0.5) * 1.12 + 0.5;

  vec2 foamTexel = vec2(1.0 / 2160.0, 1.0 / 456.0);
  float foamAverage = 0.25 * (
    dot(mix(texture2D(uPosterTexture, vec2(sampleX + foamTexel.x, sourceY)).rgb, texture2D(uVideoTexture, vec2(sampleX + foamTexel.x, sourceY)).rgb, uVideoReady * hitMotion), vec3(0.299, 0.587, 0.114)) +
    dot(mix(texture2D(uPosterTexture, vec2(sampleX - foamTexel.x, sourceY)).rgb, texture2D(uVideoTexture, vec2(sampleX - foamTexel.x, sourceY)).rgb, uVideoReady * hitMotion), vec3(0.299, 0.587, 0.114)) +
    dot(mix(texture2D(uPosterTexture, vec2(sampleX, sourceY + foamTexel.y)).rgb, texture2D(uVideoTexture, vec2(sampleX, sourceY + foamTexel.y)).rgb, uVideoReady * hitMotion), vec3(0.299, 0.587, 0.114)) +
    dot(mix(texture2D(uPosterTexture, vec2(sampleX, sourceY - foamTexel.y)).rgb, texture2D(uVideoTexture, vec2(sampleX, sourceY - foamTexel.y)).rgb, uVideoReady * hitMotion), vec3(0.299, 0.587, 0.114))
  );
  foam += clamp(luma - foamAverage, -0.07, 0.09) * 0.52;

  float calmInterface = 1.0 - smoothstep(0.0, 0.14, sampleY);
  foam = mix(foam, creamBody * vec3(0.96, 0.95, 0.91), calmInterface * 0.62);

  float wet = 1.0 - smoothstep(0.0, 0.034, sampleY);
  foam = mix(foam, vec3(0.70, 0.49, 0.20) + photographed * 0.22, wet * 0.24);
  foam += uHit * 0.018 * smoothstep(0.10, 0.75, sampleY);

  float density = mix(0.94, 1.0, smoothstep(0.58, 0.94, luma));
  density *= mix(0.88, 1.0, smoothstep(0.0, 0.035, sampleY));
  float alpha = foamMask * density;

  gl_FragColor = vec4(max(foam, vec3(0.0)), alpha);
}
