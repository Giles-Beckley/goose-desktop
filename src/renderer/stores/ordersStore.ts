import { create } from 'zustand';
import type { Order } from '../../shared/types';

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  setOrders: (orders: Order[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  loading: false,
  error: null,
  setOrders: (orders) => set({ orders, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
