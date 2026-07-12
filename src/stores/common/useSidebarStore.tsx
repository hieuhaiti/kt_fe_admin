import { create } from 'zustand'

export const useSidebarStore = create((set) => ({
  isExpanded: true,
  setExpanded: (isExpanded: boolean) => set({ isExpanded }),
  toggleSidebar: () => set((state: { isExpanded: any }) => ({ isExpanded: !state.isExpanded })),
}))
