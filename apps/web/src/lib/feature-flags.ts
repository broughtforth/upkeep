// Feature flags. Flip these to hide / show entire UI surfaces without
// deleting any code. Useful for staging stuff we've built but aren't ready
// to show users yet.
//
// To re-enable a hidden feature, just flip its flag back to `true` —
// every guard around the app reads from here.

export const FEATURES = {
  // Deep-clean rotations: the "+ DEEP CLEAN" chip on room cards, the
  // biohazard tape rings around quarantined rooms, and the hazmat suits
  // on residents working in those rooms. Set true to bring it back.
  deepClean: false,
} as const;
