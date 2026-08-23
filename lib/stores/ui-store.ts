import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  selectedBranchId: string | "all";
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedBranchId: (branchId: string | "all") => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  selectedBranchId: "all",
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedBranchId: (branchId) => set({ selectedBranchId: branchId }),
}));
