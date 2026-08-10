import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { enUS } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getDateLocale(language: string) {
  switch (language) {
    case 'am':
      // date-fns doesn't support Amharic yet, fallback to English
      return enUS;
    case 'om':
      // date-fns doesn't support Afaan Oromoo yet, fallback to English
      return enUS; 
    default:
      return enUS;
  }
}
