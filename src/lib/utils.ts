import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Type helper for components with element refs
export type WithElementRef<T, E extends HTMLElement = HTMLElement> = T & {
  ref?: E | null;
};

// Types for shadcn-svelte components
export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'>;
export type WithoutChild<T> = Omit<T, 'child'>;
