import type { PortId, Region } from "../sim";

/** A Port's display name, falling back to its id if the port is missing. */
export function portName(region: Region, id: PortId): string {
  return region.ports.find((p) => p.id === id)?.name ?? id;
}
