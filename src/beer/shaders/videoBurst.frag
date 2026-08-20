precision highp float;

uniform sampler2D uVideoTexture;
uniform float uReady;
uniform float uOpacity;
uniform float uTime;
uniform float uSurfaceY;
uniform float uLevel;
uniform float uWaveAmplitude;
varying vec2 vUv;

float surfaceWave(float x) {
  float wave = sin(x * 12.0 + uTime * 5.1) * 0.48;
  wave += sin(x * 21.0 - uTime * 3.8 + 1.4) * 0.32;
  wave += sin(x * 34.0 + uTime * 6.2 + 4.0) * 0.20;
  return wave * uWaveAmplitude;
}

void main() {
  float surfaceY = uSurfaceY + surfaceWave(vUv.x);
  float insideBeer = step(vUv.y, surfaceY - 0.002) * step(0.004, uLevel);

  vec3 source = texture2D(uVideoTexture, vec2(vUv.x, 0.5 + vUv.y * 0.5)).rgb;
  float matte = texture2D(uVideoTexture, vec2(vUv.x, vUv.y * 0.5)).r;
  float sparkle = smoothstep(0.008, 0.13, matte);
  float sourceLuma = dot(source, vec3(0.299, 0.587, 0.114));
  vec3 color = mix(vec3(0.76, 0.39, 0.025), vec3(1.0, 0.84, 0.34), smoothstep(0.35, 0.90, sourceLuma));
  float verticalWeight = mix(0.72, 1.0, smoothstep(0.0, max(surfaceY, 0.001), vUv.y));
  float alpha = sparkle * uReady * uOpacity * insideBeer * verticalWeight * 0.62;

  gl_FragColor = vec4(color * (0.65 + sparkle * 0.55), alpha);
}
