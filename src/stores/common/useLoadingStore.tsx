import { create } from 'zustand'

export interface LoadingStore {
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  loading: false,
  setLoading: (loading: boolean) => set({ loading }),
}))
