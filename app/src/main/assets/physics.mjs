export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function route(s) {
  const x = 85 * Math.sin(s * .003) + 30 * Math.sin(s * .008);
  const dx = .255 * Math.cos(s * .003) + .24 * Math.cos(s * .008);
  const ddx = -.000765 * Math.sin(s * .003) - .00192 * Math.sin(s * .008);
  const y = 5 * Math.sin(s * .0035) + 2 * Math.sin(s * .009);
  const dy = .0175 * Math.cos(s * .0035) + .018 * Math.cos(s * .009);
  return { x, y, dx, dy, curve: ddx, yaw: -Math.atan(dx) };
}
export function newDrive(mode = 'cruise') {
  return { mode, s: 30, distance: 0, lateral: -2.5, speed: 0, steer: 0, nitro: 100,
    elapsed: 0, remaining: 150, score: 0, combo: 0, health: 100, impact: 0, finished: false, won: false, boosting: false };
}
export function tick(state, input, dt) {
  if (state.finished || dt <= 0) return;
  dt = Math.min(dt, .05);
  state.elapsed += dt;
  state.impact = Math.max(0, state.impact - dt);
  const brake = !!input.brake;
  const gas = !brake && !!input.gas;
  state.boosting = gas && !!input.boost && state.nitro > 1 && state.speed > 4;
  state.nitro = clamp(state.nitro + (state.boosting ? -25 : 9) * dt, 0, 100);
  state.steer += (clamp(input.steer || 0, -1, 1) - state.steer) * (1 - Math.exp(-dt * 9));
  const offroad = Math.abs(state.lateral) > 5.1;
  const drag = .65 + .0028 * state.speed * state.speed + (offroad ? 9 : 0);
  const accel = gas ? (state.boosting ? 19 : state.speed < 54 ? 11 : 0) : 0;
  state.speed = clamp(state.speed + (accel - drag - (brake ? 26 : 0)) * dt, 0, 68);
  const path = route(state.s);
  state.lateral += (state.steer * (2.5 + state.speed * .14) - path.curve * state.speed * state.speed * .23) * dt * Math.min(1, state.speed / 3);
  if (Math.abs(state.lateral) > 10) {
    state.lateral = clamp(state.lateral, -10, 10);
    state.speed *= Math.exp(-dt * 4);
  }
  const travel = state.speed * dt;
  state.s += travel / Math.sqrt(1 + path.dx * path.dx);
  state.distance += travel;
  state.score += travel * (state.boosting ? 1.6 : 1);
  if (state.mode === 'sprint') {
    state.remaining = Math.max(0, state.remaining - dt);
    if (state.distance >= 3000) { state.finished = true; state.won = true; }
    else if (state.remaining <= 0 || state.health <= 0) state.finished = true;
  }
}
export function impact(state) {
  if (state.impact > 0) return false;
  state.speed *= .35;
  state.health = Math.max(0, state.health - 22);
  state.combo = 0;
  state.impact = 1.4;
  return true;
}
