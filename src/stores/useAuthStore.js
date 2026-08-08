import { create } from "zustand";

const useAuthStore = create(set => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,

  setSession: session => set({
    session,
    user: session?.user ?? null
  }),

  setProfile: profile => set({ profile }),

  setInitialized: initialized => set({ initialized }),

  clearAuth: () => set({
    session: null,
    user: null,
    profile: null
  })
}));

export default useAuthStore;