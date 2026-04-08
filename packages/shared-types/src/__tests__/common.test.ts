import { describe, it, expect } from 'vitest';
import type { UUID, Cents, ISOTimestamp } from '../common';

describe('common', () => {
  describe('type aliases', () => {
    it('UUID is a string', () => {
      const val: UUID = 'test-uuid';
      expect(typeof val).toBe('string');
    });

    it('Cents is a number', () => {
      const val: Cents = 100;
      expect(typeof val).toBe('number');
    });

    it('ISOTimestamp is a string', () => {
      const val: ISOTimestamp = '2026-02-18T07:36:53Z';
      expect(typeof val).toBe('string');
    });
  });
});
