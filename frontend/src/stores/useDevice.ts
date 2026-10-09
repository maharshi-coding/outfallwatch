import { create } from "zustand";

/** Which device the live pages display. null = auto (prefer a HARDWARE device, else the sim). */
interface DeviceState {
  selectedId: string | null;
  setSelected: (id: string | null) => void;
}

export const useDevice = create<DeviceState>((set) => ({
  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),
}));
