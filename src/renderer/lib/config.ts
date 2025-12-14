import Store from 'electron-store';
import { reactive, watch } from 'vue';

// Configuration shape for the renderer
export type RendererConfig = {
  // Whether the shutdown timer feature is enabled
  shutdownTimer: boolean;
  // Timer length in seconds
  timerLength: number;
  // Allow other arbitrary configuration entries
  [key: string]: any;
};

export const defaultConfig: RendererConfig = {
  // default: disabled
  shutdownTimer: false,
  // default: 5 minutes (300 seconds)
  timerLength: 300,
};

const store = new Store<RendererConfig>({ name: 'renderer-config' });

// Merge persisted values with defaults
const initial = Object.assign({}, defaultConfig, store.store || {});

// Reactive config object that UI can bind to
export const config = reactive<RendererConfig>(initial as RendererConfig);

// Persist changes to the store whenever config changes
watch(
  config,
  (newVal) => {
    // Write only the known keys so we don't overwrite unrelated store data
    store.set(Object.assign({}, newVal));
  },
  { deep: true }
);

export function resetConfigToDefaults() {
  Object.keys(defaultConfig).forEach((k) => {
    // @ts-ignore
    config[k] = defaultConfig[k];
  });
}
