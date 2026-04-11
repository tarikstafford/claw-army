import { EventEmitter } from 'node:events';
import type { FleetEvent } from '@claw/event-schemas';

class FleetEventBus extends EventEmitter {
  private static instance: FleetEventBus;

  static getInstance(): FleetEventBus {
    if (!FleetEventBus.instance) {
      FleetEventBus.instance = new FleetEventBus();
    }
    return FleetEventBus.instance;
  }

  emitFleetEvent(event: FleetEvent): void {
    this.emit('fleet-event', event);
  }

  onFleetEvent(handler: (event: FleetEvent) => void): () => void {
    this.on('fleet-event', handler);
    return () => this.off('fleet-event', handler);
  }
}

export const fleetEventBus = FleetEventBus.getInstance();

export interface FleetEventPayload {
  type: string;
  botId?: string;
  executionId?: string;
  soulId?: string;
  taskCategory?: string;
  verdictType?: string;
  fromClass?: string;
  toClass?: string;
  transitionType?: string;
  compositeScore?: string;
  isPioneer?: boolean;
  description: string;
}
