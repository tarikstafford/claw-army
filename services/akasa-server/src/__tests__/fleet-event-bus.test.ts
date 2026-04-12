import { describe, it, expect, vi } from 'vitest';
import { fleetEventBus } from '../services/fleet-event-bus.js';

describe('fleet-event-bus', () => {
  it('is a singleton (same instance on every import)', async () => {
    const { fleetEventBus: bus2 } = await import('../services/fleet-event-bus.js');
    expect(fleetEventBus).toBe(bus2);
  });

  it('emitFleetEvent delivers event to onFleetEvent listeners', () => {
    const handler = vi.fn();
    const unsub = fleetEventBus.onFleetEvent(handler);

    const event = { type: 'bot_spawned', timestamp: new Date().toISOString() } as any;
    fleetEventBus.emitFleetEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('onFleetEvent returns an unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = fleetEventBus.onFleetEvent(handler);

    fleetEventBus.emitFleetEvent({ type: 'first' } as any);
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();

    fleetEventBus.emitFleetEvent({ type: 'second' } as any);
    expect(handler).toHaveBeenCalledTimes(1); // still 1 after unsub
  });

  it('supports multiple listeners', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsub1 = fleetEventBus.onFleetEvent(handler1);
    const unsub2 = fleetEventBus.onFleetEvent(handler2);

    fleetEventBus.emitFleetEvent({ type: 'test' } as any);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });
});
