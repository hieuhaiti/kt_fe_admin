import { create } from 'zustand'

interface SidebarStore {
  isExpanded: boolean
  setExpanded: (isExpanded: boolean) => void
  toggleSidebar: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isExpanded: true,
  setExpanded: (isExpanded: boolean) => set({ isExpanded }),
  toggleSidebar: () => set((state) => ({ isExpanded: !state.isExpanded })),
}))
