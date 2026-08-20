precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFillTopY;
uniform float uLevel;
uniform float uWaveAmplitude;
uniform float uHit;
varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float condensationLayer(vec2 uv, vec2 grid) {
  vec2 p = uv * grid;
  vec2 id = floor(p);
  vec2 cell = fract(p) - 0.5;
  vec2 offset = vec2(hash21(id + 1.7), hash21(id + 8.3)) - 0.5;
  float radius = mix(0.055, 0.16, hash21(id + 4.2));
  float d = length((cell - offset * 0.62) * vec2(1.0, 0.72));
  float outer = 1.0 - smoothstep(radius, radius + 0.035, d);
  float inner = 1.0 - smoothstep(radius - 0.035, radius, d);
  return max(outer - inner, 0.0) * step(0.62, hash21(id + 12.6));
}

float surfaceWave(float x) {
  float wave = sin(x * 12.0 + uTime * 5.1) * 0.48;
  wave += sin(x * 21.0 - uTime * 3.8 + 1.4) * 0.32;
  wave += sin(x * 34.0 + uTime * 6.2 + 4.0) * 0.20;
  return wave * uWaveAmplitude;
}

void main() {
  float fillTop = uFillTopY + surfaceWave(vUv.x);
  float visible = smoothstep(0.002, 0.025, uLevel);
  float liquidMask = 1.0 - smoothstep(fillTop - 0.003, fillTop + 0.006, vUv.y);

  float edgeDistance = abs(vUv.x - 0.5) * 2.0;
  float edgeFresnel = pow(smoothstep(0.86, 1.0, edgeDistance), 1.65);
  float sideHighlight = exp(-pow((edgeDistance - 0.935) * 28.0, 2.0));
  sideHighlight *= 0.72 + 0.28 * sin(vUv.y * 8.0 + edgeDistance * 2.0);

  float droplets = condensationLayer(vUv, vec2(18.0, 34.0));
  droplets += condensationLayer(vUv + vec2(0.031, 0.017), vec2(29.0, 51.0)) * 0.55;
  droplets *= pow(smoothstep(0.78, 1.0, edgeDistance), 1.6);

  float hitShimmer = sin(vUv.y * 42.0 - uTime * 8.0) * edgeFresnel * uHit;
  vec3 color = vec3(0.88, 0.95, 1.0);
  color += vec3(0.10, 0.03, 0.0) * max(hitShimmer, 0.0);

  float opticalAlpha = edgeFresnel * 0.042 + sideHighlight * 0.050 + droplets * 0.085;
  float alpha = opticalAlpha * liquidMask * visible;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.16));
}
