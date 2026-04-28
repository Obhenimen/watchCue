/**
 * Globals expected by React Native code under test. Without this,
 * api.ts's `if (__DEV__)` branches throw ReferenceError in node.
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
