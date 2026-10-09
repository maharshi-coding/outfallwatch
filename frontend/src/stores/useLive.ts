import { create } from "zustand";
import { subscribeEvents, type StreamEvent } from "../services/api";

export interface LiveReading {
  device_id: string;
  source: string;
  observed_at: string;
  turbidity_index: number | null;
  temperature_c: number | null;
  conductivity_us_cm: number | null;
  mode: string;
  health: string;
  baseline: number | null;
  delta: number | null;
  storm_active: boolean;
}

interface LiveState {
  connected: boolean;
  readings: LiveReading[]; // rolling buffer, newest last
  lastAlert: Record<string, unknown> | null;
  simEvent: Record<string, unknown> | null;
  alertTick: number; // bumps when an alert frame arrives, so pages can refetch
  start: () => void;
  stop: () => void;
  _unsub?: () => void;
}

const MAX = 400;

export const useLive = create<LiveState>((set, get) => ({
  connected: false,
  readings: [],
  lastAlert: null,
  simEvent: null,
  alertTick: 0,
  start: () => {
    if (get()._unsub) return; // one connection only
    const unsub = subscribeEvents(
      (e: StreamEvent) => {
        if (e.type === "reading" && e.data) {
          set((s) => ({ readings: [...s.readings, e.data as unknown as LiveReading].slice(-MAX) }));
        } else if (e.type === "alert" && e.data) {
          set((s) => ({ lastAlert: e.data!, alertTick: s.alertTick + 1 }));
        } else if (e.type === "simulation" && e.data) {
          set({ simEvent: e.data });
        }
      },
      (connected) => set({ connected }),
    );
    set({ _unsub: unsub });
  },
  stop: () => {
    get()._unsub?.();
    set({ _unsub: undefined, connected: false });
  },
}));
