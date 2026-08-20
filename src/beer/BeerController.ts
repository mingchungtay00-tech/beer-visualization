import * as THREE from 'three';

export type BeerFrameState = {
  currentLevel: number;
  targetLevel: number;
  velocity: number;
  impact: number;
  waveAmplitude: number;
  foamScale: number;
  fillTopY: number;
  surfaceY: number;
};

const FULL_FOAM_TOP_Y = 1.0;
const FULL_SURFACE_Y = 0.894;
const FULL_FOAM_THICKNESS = FULL_FOAM_TOP_Y - FULL_SURFACE_Y;

export class BeerController {
  currentLevel = 0;
  targetLevel = 0;
  velocity = 0;
  impact = 0;

  private waveEnergy = 0;
  private foamPulse = 0;
  private foamPulseVelocity = 0;

  setBeerLevel(percent: number): void {
    const normalized = percent > 1 ? percent / 100 : percent;
    this.targetLevel = THREE.MathUtils.clamp(normalized, 0, 1);
  }

  addBeer(amount: number): void {
    const quantized = Math.round((this.targetLevel + amount) * 1000) / 1000;
    this.targetLevel = THREE.MathUtils.clamp(quantized, 0, 1);
  }

  hitBeer(amount: number): void {
    const before = this.targetLevel;
    this.addBeer(amount);

    const cappedPositiveHit = amount > 0 && before >= 0.999;
    if (this.targetLevel !== before || cappedPositiveHit) {
      this.impact = Math.min(1, this.impact + 0.95);
      this.waveEnergy = Math.min(1, this.waveEnergy + 0.85);
      this.foamPulseVelocity -= 1.05;
    }
  }

  reset(): void {
    if (this.targetLevel > 0 || this.currentLevel > 0.002) {
      this.setBeerLevel(0);
      this.impact = Math.min(1, this.impact + 0.35);
      this.waveEnergy = Math.min(1, this.waveEnergy + 0.45);
    }
  }

  update(deltaTime: number): BeerFrameState {
    const dt = Math.min(deltaTime, 0.05);
    const stiffness = 18;
    const damping = 6;
    const displacement = this.targetLevel - this.currentLevel;
    const acceleration = displacement * stiffness - this.velocity * damping;

    this.velocity += acceleration * dt;
    this.currentLevel += this.velocity * dt;

    if (this.targetLevel === 0 && this.currentLevel < 0.001 && Math.abs(this.velocity) < 0.01) {
      this.currentLevel = 0;
      this.velocity = 0;
    }

    if (this.targetLevel === 1 && this.currentLevel > 1 && Math.abs(this.velocity) < 0.015) {
      this.currentLevel = 1;
      this.velocity = 0;
    }

    this.currentLevel = THREE.MathUtils.clamp(this.currentLevel, 0, 1.035);
    this.impact = Math.max(0, this.impact - dt * 0.78);
    this.waveEnergy = Math.max(0, this.waveEnergy - dt * 0.92);

    const foamAcceleration = -this.foamPulse * 28 - this.foamPulseVelocity * 8;
    this.foamPulseVelocity += foamAcceleration * dt;
    this.foamPulse += this.foamPulseVelocity * dt;
    this.foamPulse = THREE.MathUtils.clamp(this.foamPulse, -0.12, 0.13);

    const visibleLevel = THREE.MathUtils.clamp(this.currentLevel, 0, 1);
    const fillTopY = visibleLevel * FULL_FOAM_TOP_Y;
    const foamThickness = Math.min(
      FULL_FOAM_THICKNESS * (1 + this.foamPulse),
      fillTopY * 0.34,
    );
    const foamScale = FULL_FOAM_THICKNESS > 0 ? foamThickness / FULL_FOAM_THICKNESS : 0;
    const surfaceY = Math.max(0, fillTopY - foamThickness);

    return {
      currentLevel: this.currentLevel,
      targetLevel: this.targetLevel,
      velocity: this.velocity,
      impact: this.impact,
      waveAmplitude: this.waveEnergy * (0.006 + Math.min(Math.abs(this.velocity), 1) * 0.012),
      foamScale,
      fillTopY,
      surfaceY,
    };
  }
}
