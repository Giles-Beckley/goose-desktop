import { create } from 'zustand';
import type { Customer } from '../../shared/types';

interface CustomersState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  setCustomers: (customers: Customer[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCustomersStore = create<CustomersState>((set) => ({
  customers: [],
  loading: false,
  error: null,
  setCustomers: (customers) => set({ customers, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
