import type { TransactionKind } from './types';

export type Category = {
  id: string;
  name: string;
  kind: TransactionKind;
  /** Nombre de icono de Ionicons. */
  icon: string;
  color: string;
};

export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Comida', kind: 'expense', icon: 'restaurant', color: '#F97316' },
  { id: 'transport', name: 'Transporte', kind: 'expense', icon: 'bus', color: '#3B82F6' },
  { id: 'home', name: 'Hogar', kind: 'expense', icon: 'home', color: '#8B5CF6' },
  { id: 'bills', name: 'Servicios', kind: 'expense', icon: 'flash', color: '#EAB308' },
  { id: 'health', name: 'Salud', kind: 'expense', icon: 'medkit', color: '#EF4444' },
  { id: 'fun', name: 'Ocio', kind: 'expense', icon: 'game-controller', color: '#EC4899' },
  { id: 'shopping', name: 'Compras', kind: 'expense', icon: 'bag-handle', color: '#14B8A6' },
  { id: 'other-expense', name: 'Otros', kind: 'expense', icon: 'ellipsis-horizontal', color: '#64748B' },
  { id: 'salary', name: 'Salario', kind: 'income', icon: 'briefcase', color: '#16A34A' },
  { id: 'freelance', name: 'Extras', kind: 'income', icon: 'cash', color: '#22C55E' },
  { id: 'other-income', name: 'Otros', kind: 'income', icon: 'ellipsis-horizontal', color: '#64748B' },
];

const FALLBACK: Category = {
  id: 'unknown',
  name: 'Sin categoría',
  kind: 'expense',
  icon: 'help',
  color: '#94A3B8',
};

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? FALLBACK;
}

export function categoriesFor(kind: TransactionKind): Category[] {
  return CATEGORIES.filter((c) => c.kind === kind);
}
