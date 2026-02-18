/**
 * Common branded types for documentation clarity and type safety.
 * These are plain string/number aliases — no runtime cost.
 */

/** A UUID v4 string identifier */
export type UUID = string;

/** A monetary value expressed in integer cents (never float) */
export type Cents = number;

/** An ISO 8601 timestamp string (e.g. "2026-02-18T07:36:53Z") */
export type ISOTimestamp = string;
