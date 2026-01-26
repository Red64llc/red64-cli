/**
 * Extended Flow State Machine Subscription Tests
 * Task 2.3: Add state persistence and event subscription for phase changes
 * Requirements: 2.3, 2.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createExtendedFlowMachine,
  type ExtendedFlowMachineService
} from '../../src/services/ExtendedFlowStateMachine.js';
import type { ExtendedFlowPhase } from '../../src/types/extended-flow.js';

describe('ExtendedFlowStateMachine - Subscription', () => {
  let machine: ExtendedFlowMachineService;

  beforeEach(() => {
    machine = createExtendedFlowMachine();
  });

  describe('subscribe', () => {
    it('should notify subscriber on phase change', () => {
      const listener = vi.fn();
      machine.subscribe(listener);

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'initializing'
      }));
    });

    it('should notify multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      machine.subscribe(listener1);
      machine.subscribe(listener2);

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should notify subscribers synchronously after state update', () => {
      let phaseAtNotification: ExtendedFlowPhase | null = null;

      machine.subscribe((phase) => {
        phaseAtNotification = phase;
      });

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      // Subscription should have been called with the new phase
      expect(phaseAtNotification).toEqual(machine.getPhase());
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = machine.subscribe(listener);

      // First event should be received
      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second event should not be received
      machine.send({ type: 'PHASE_COMPLETE' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not call unsubscribed listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = machine.subscribe(listener1);
      machine.subscribe(listener2);

      unsub1(); // Unsubscribe first listener

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple state changes', () => {
      const phases: ExtendedFlowPhase[] = [];

      machine.subscribe((phase) => {
        phases.push(phase);
      });

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });
      machine.send({ type: 'PHASE_COMPLETE' });
      machine.send({ type: 'PHASE_COMPLETE' });

      expect(phases).toHaveLength(3);
      expect(phases[0].type).toBe('initializing');
      expect(phases[1].type).toBe('requirements-generating');
      expect(phases[2].type).toBe('requirements-approval');
    });
  });

  describe('preventing memory leaks', () => {
    it('should allow unsubscribing the same listener multiple times without error', () => {
      const listener = vi.fn();
      const unsubscribe = machine.subscribe(listener);

      unsubscribe();
      unsubscribe(); // Should not throw

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle subscribing the same function multiple times', () => {
      const listener = vi.fn();

      const unsub1 = machine.subscribe(listener);
      const unsub2 = machine.subscribe(listener);

      machine.send({
        type: 'START',
        feature: 'test',
        description: 'Test',
        mode: 'greenfield'
      });

      // Same function subscribed twice should only be called once (Set behavior)
      expect(listener).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });
  });
});
