/**
 * Network Monitor — tracks connectivity, fires events on change
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

interface NetworkStore {
  isOnline: boolean;
  connectionType: string | null;
  setOnline: (online: boolean, type?: string | null) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: true,
  connectionType: null,
  setOnline: (isOnline, connectionType = null) => set({ isOnline, connectionType }),
}));

let unsubscribe: (() => void) | null = null;

export function startNetworkMonitor() {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    useNetworkStore.getState().setOnline(isOnline, state.type);
  });
}

export function stopNetworkMonitor() {
  unsubscribe?.();
  unsubscribe = null;
}

export function isOnline(): boolean {
  return useNetworkStore.getState().isOnline;
}
