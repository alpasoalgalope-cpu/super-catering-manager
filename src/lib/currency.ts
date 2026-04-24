/**
 * Senior Architect Utility: Financial Localization (Argentina)
 * Handles the transformation of user input (strings with points/commas) 
 * into valid JS Numbers for Supabase persistence, ensuring decimal integrity.
 */

/**
 * Normaliza una entrada de usuario que puede contener puntos y comas.
 * Convierte formato AR (1.234,56) a formato computacional (1234.56).
 */
export function normalizeCurrencyInput(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  // 1. Eliminar puntos de miles
  // 2. Reemplazar coma decimal por punto
  const cleanValue = value
    .toString()
    .replace(/\./g, '') // Quita separadores de miles
    .replace(/,/g, '.'); // Convierte coma decimal a punto

  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formatea un número al estándar financiero Argentino (es-AR).
 * Ejemplo: 1234.56 -> 1.234,56
 */
export const formatCurrencyAR = (value: number, decimals: number = 2) => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Formatea un número como moneda ARS.
 */
export const formatMoneyAR = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
};
