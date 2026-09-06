export interface CameraMotion {
  lookAhead: number;
  lookTarget: number;
  direction: number;
  stableMs: number;
}

export function stepHorizontalCamera(
  previous: CameraMotion,
  currentCenter: number,
  playerX: number,
  velocityX: number,
  viewWidth: number,
  deltaMs: number,
): CameraMotion & { center: number } {
  const delta = Math.max(0, Math.min(50, deltaMs));
  const direction = Math.abs(velocityX) > 140 ? Math.sign(velocityX) : 0;
  const stableMs = direction !== 0 && direction === previous.direction ? Math.min(1000, previous.stableMs + delta) : 0;
  // Brief turns and attack aiming do not move the look-ahead target.
  const lookTarget = stableMs >= 180 ? direction * Math.min(36, viewWidth * 0.04) : previous.lookTarget;
  const lookAhead = previous.lookAhead + (lookTarget - previous.lookAhead) * (1 - Math.exp(-delta / 650));
  const error = playerX + lookAhead - currentCenter;
  const deadZone = Math.min(24, viewWidth * 0.03);
  const distance = Math.sign(error) * Math.max(0, Math.abs(error) - deadZone);
  const maxStep = 480 * delta / 1000;
  const movement = Math.max(-maxStep, Math.min(maxStep, distance * (1 - Math.exp(-delta / 220))));
  return { lookAhead, lookTarget, direction, stableMs, center: currentCenter + movement };
}
