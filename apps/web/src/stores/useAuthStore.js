import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      actor: null,
      isLoggedIn: false,
      login: (actor) => set({ actor, isLoggedIn: true }),
      logout: () => set({ actor: null, isLoggedIn: false }),
    }),
    {
      name: 'enterprise-agent-hub-auth',
    }
  )
);
