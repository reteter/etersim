/**
 * Linear map from a port's unit-plane coordinate (0..1, worldgen) to an SVG
 * viewBox coordinate, leaving `padding` clear on both edges so nodes and
 * labels near 0/1 don't clip.
 */
export function projectToViewBox(unit: number, size: number, padding: number): number {
  return padding + unit * (size - 2 * padding);
}
