import { create } from "zustand";

interface ConnectionState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingWrites: number;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setPendingWrites: (count: number) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingWrites: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingWrites: (pendingWrites) => set({ pendingWrites }),
}));
