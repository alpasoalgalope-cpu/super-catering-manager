/**
 * Interface representing a Free Meal Rule from the database
 */
export interface FreeMealRule {
  id?: string
  code?: string
  sale_mode: string
  vehicle_type?: string
  min_conversion?: number | null
  role?: string
  quantity: number
}

/**
 * Calculates the number of free meals assigned to a specific transport unit/bus
 * based on the company's rule and its capacity/sales.
 */
export function calculateFreeMeals(
  rules: FreeMealRule[],
  soldPax: number,
  totalPax: number,
  vehicleType: "Micro" | "Traffic",
  saleMode: string
): number {
  let freeMeals = 0;
  const soldPercentage = totalPax > 0 ? (soldPax / totalPax) * 100 : 0;

  const applicableRules = rules.filter(r => 
    r.sale_mode === saleMode && 
    (!r.vehicle_type || r.vehicle_type === vehicleType || r.vehicle_type === 'Todos')
  );

  for (const rule of applicableRules) {
    if (!rule.min_conversion || rule.min_conversion === 0) {
      freeMeals += rule.quantity;
    } else if (soldPercentage >= rule.min_conversion) {
      freeMeals += rule.quantity;
    }
  }

  return freeMeals;
}

/**
 * Calculates the final cost structure for a sold unit/event based on Company Prices.
 * It applies the Sin TACC price only to the units that EXCEED the included quota.
 *
 * @param standardPrice Price of a normal sandwich
 * @param sintaccPrice Price of a Sin TACC sandwich
 * @param totalPax Total sold pax
 * @param sintaccPax Total Sin TACC sold pax
 * @param includedPct Percentage of Sin TACC included in the base price (default 5%)
 * @returns Costing breakdown
 */
export function calculateBusCost(
  standardPrice: number,
  sintaccPrice: number,
  totalPax: number,
  sintaccPax: number,
  includedPct: number = 0
) {
  // Redondeo hacia arriba (Ceil) según pedido estricto
  const quota = Math.ceil(totalPax * (includedPct / 100))
  const excessSintacc = Math.max(0, sintaccPax - quota)
  const safeSintacc = sintaccPax - excessSintacc
  
  // Fórmula estricta: (Venta Total - Excedentes) * Precio Base + Excedentes * Precio ST
  // Esto garantiza que el total de unidades siempre sea igual al total Pax
  const baseTotal = (totalPax - excessSintacc) * standardPrice
  const surchargeTotal = excessSintacc * sintaccPrice
  const finalAmount = baseTotal + surchargeTotal

  return {
    baseTotal,
    surchargeTotal,
    finalAmount,
    excessSintacc,
    safeSintacc
  }
}
