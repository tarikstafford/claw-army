/** World mode — 'front-office' is the default, 'back-office' is the dark technical world. */
export type AkasaMode = 'front-office' | 'back-office';

const STORAGE_KEY = 'akasa-mode';

/**
 * Set the active world mode. Updates both the DOM class and localStorage.
 * Call this from the mode toggle UI (Phase 3 NavBar component).
 */
export function setMode(mode: AkasaMode): void {
  if (mode === 'back-office') {
    document.body.classList.add('back-office');
    try { localStorage.setItem(STORAGE_KEY, 'back-office'); } catch (_) {}
  } else {
    document.body.classList.remove('back-office');
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }
}

/**
 * Get the current mode by checking the body class (source of truth after hydration).
 */
export function getMode(): AkasaMode {
  return document.body.classList.contains('back-office') ? 'back-office' : 'front-office';
}

/**
 * Toggle between modes. Returns the new mode.
 */
export function toggleMode(): AkasaMode {
  const next: AkasaMode = getMode() === 'back-office' ? 'front-office' : 'back-office';
  setMode(next);
  return next;
}
