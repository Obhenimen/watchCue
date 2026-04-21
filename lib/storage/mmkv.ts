import { createMMKV } from "react-native-mmkv";

/**
 * Single MMKV instance for the whole app.
 * Using a dedicated ID keeps WatchCue data isolated from other
 * libraries that might also use MMKV internally.
 */
export const storage = createMMKV({ id: "watchcue-storage" });
