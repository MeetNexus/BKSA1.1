import { Product, WeekData, Order } from '../types/interfaces'
import { addDays, isBefore, isAfter, isSameDay } from 'date-fns'

export function convertToUnits(value: number, product: Product): number {
  if (!product.unit_conversion) return value
  
  const { number_of_packs, units_per_pack } = product.unit_conversion
  if (!number_of_packs || !units_per_pack) return value
  
  return value * number_of_packs * units_per_pack
}

export function convertToPackages(value: number, product: Product): number {
  if (!product.unit_conversion) return value
  
  const { number_of_packs, units_per_pack } = product.unit_conversion
  if (!number_of_packs || !units_per_pack) return value
  
  const totalUnitsPerPackage = number_of_packs * units_per_pack
  return Math.round((value / totalUnitsPerPackage) * 100) / 100
}

function getEffectiveStock(order: Order | undefined, productId: number): number {
  if (!order) return 0
  
  // Si un stock réel est saisi, on l'utilise
  if (order.real_stock?.[productId] !== undefined) {
    return order.real_stock[productId]
  }
  
  // Sinon on utilise le stock théorique s'il existe
  if (order.theoretical_stock?.[productId] !== undefined) {
    return order.theoretical_stock[productId]
  }
  
  // Si aucun stock n'est disponible, on retourne 0
  return 0
}

function getOrderedQuantity(order: Order | undefined, productId: number): number {
  if (!order?.ordered_quantities) return 0
  
  const quantity = order.ordered_quantities[productId]
  // On retourne 0 si la quantité est undefined, null, ou NaN
  return quantity || 0
}

export function calculateTheoreticalStock(
  order: Order,
  product: Product,
  previousOrders: Order[],
  previousWeekOrders: Order[]
): number {
  let theoreticalStock = 0

  switch (order.order_number) {
    case 1: {
      // Stock taken on Monday (3 days before Thursday delivery)
      const prevWeekOrder3 = previousWeekOrders.find(o => o.order_number === 3)
      const prevWeekOrder2 = previousWeekOrders.find(o => o.order_number === 2)
      
      if (prevWeekOrder3 && prevWeekOrder2) {
        // Get stock from order 3 (real or theoretical)
        const prevStock = getEffectiveStock(prevWeekOrder3, product.id!)
        
        // Get ordered quantity from order 2
        const prevOrderedQty = getOrderedQuantity(prevWeekOrder2, product.id!)
        
        // Calculate total available stock (previous stock + delivered quantity)
        const totalAvailableStock = prevStock + prevOrderedQty
        
        // Calculate consumption from Friday to Sunday (included) of previous week
        const stockTakingDate = addDays(new Date(order.delivery_date), -3) // Monday
        const fridayToSunday = {
          startDate: addDays(stockTakingDate, -3), // Friday (3 days before Monday)
          endDate: addDays(stockTakingDate, -1)    // Sunday (1 day before Monday)
        }
        
        const weekendConsumption = calculatePeriodConsumption(
          product,
          prevWeekOrder3.week_data, // Using previous week's data
          fridayToSunday.startDate,
          fridayToSunday.endDate
        )
        
        // Calculate theoretical stock by subtracting consumption from total available stock
        theoreticalStock = totalAvailableStock - weekendConsumption
      }
      break
    }
    case 2: {
      // Stock taken on Wednesday (3 days before Saturday delivery)
      const prevWeekOrder3 = previousWeekOrders.find(o => o.order_number === 3)
      const currentOrder1 = previousOrders.find(o => o.order_number === 1)
      
      if (prevWeekOrder3 && currentOrder1) {
        // Get stock from order 1 (real or theoretical)
        const prevStock = getEffectiveStock(currentOrder1, product.id!)
        
        // Get ordered quantity from previous week's order 3
        const prevOrderedQty = getOrderedQuantity(prevWeekOrder3, product.id!)
        
        // Calculate total available stock (previous stock + delivered quantity)
        const totalAvailableStock = prevStock + prevOrderedQty
        
        // Calculate consumption from Monday to Tuesday (included)
        const stockTakingDate = addDays(new Date(order.delivery_date), -3) // Wednesday
        const mondayToTuesday = {
          startDate: addDays(stockTakingDate, -2), // Monday (2 days before Wednesday)
          endDate: addDays(stockTakingDate, -1)    // Tuesday (1 day before Wednesday)
        }
        
        const mondayTuesdayConsumption = calculatePeriodConsumption(
          product,
          currentOrder1.week_data, // Using current week's data
          mondayToTuesday.startDate,
          mondayToTuesday.endDate
        )
        
        // Calculate theoretical stock by subtracting consumption from total available stock
        theoreticalStock = totalAvailableStock - mondayTuesdayConsumption
      }
      break
    }
    case 3: {
      // Stock taken on Friday (4 days before Tuesday delivery)
      const currentOrder1 = previousOrders.find(o => o.order_number === 1)
      const currentOrder2 = previousOrders.find(o => o.order_number === 2)
      
      if (currentOrder1 && currentOrder2) {
        // Get stock from order 2 (real or theoretical)
        const prevStock = getEffectiveStock(currentOrder2, product.id!)
        
        // Get ordered quantity from order 1
        const prevOrderedQty = getOrderedQuantity(currentOrder1, product.id!)
        
        // Calculate total available stock (previous stock + delivered quantity)
        const totalAvailableStock = prevStock + prevOrderedQty
        
        // Calculate consumption from Wednesday to Thursday (included)
        const stockTakingDate = addDays(new Date(order.delivery_date), -4) // Friday
        const wednesdayToThursday = {
          startDate: addDays(stockTakingDate, -2), // Wednesday (2 days before Friday)
          endDate: addDays(stockTakingDate, -1)    // Thursday (1 day before Friday)
        }
        
        const wednesdayThursdayConsumption = calculatePeriodConsumption(
          product,
          currentOrder2.week_data, // Using current week's data
          wednesdayToThursday.startDate,
          wednesdayToThursday.endDate
        )
        
        // Calculate theoretical stock by subtracting consumption from total available stock
        theoreticalStock = totalAvailableStock - wednesdayThursdayConsumption
      }
      break
    }
  }

  return theoreticalStock
}

export function calculatePeriodConsumption(
  product: Product,
  weekData: WeekData | undefined,
  startDate: Date,
  endDate: Date
): number {
  if (!weekData?.consumption_data || !product.reference_produit) return 0
  
  const consumption = weekData.consumption_data[product.reference_produit] || 0
  const totalSales = calculatePeriodSalesForecast(weekData, null, startDate, endDate)
  
  return totalSales > 0 ? (consumption * totalSales) / 1000 : 0
}

export function calculateConsumption(
  product: Product,
  weekData: WeekData,
  nextWeekData: WeekData | null,
  order: Order
): number {
  if (!weekData.consumption_data || !product.reference_produit) return 0

  const consumptionPer1000 = weekData.consumption_data[product.reference_produit] || 0
  const { startDate, endDate } = getOrderPeriod(order)
  const periodSalesForecast = calculatePeriodSalesForecast(weekData, nextWeekData, startDate, endDate)
  
  return (consumptionPer1000 * periodSalesForecast) / 1000
}

export function getOrderPeriod(order: Order): { startDate: Date; endDate: Date } {
  const deliveryDate = new Date(order.delivery_date)

  switch (order.order_number) {
    case 1: 
      return {
        startDate: addDays(deliveryDate, -3), // Monday
        endDate: addDays(deliveryDate, 2), // Saturday
      }
    case 2: 
      return {
        startDate: addDays(deliveryDate, -3), // Wednesday
        endDate: addDays(addDays(deliveryDate, 7), 2), // Tuesday next week
      }
    case 3: 
      return {
        startDate: addDays(deliveryDate, -4), // Friday
        endDate: addDays(addDays(deliveryDate, 7), 2), // Thursday next week
      }
    default:
      throw new Error('Invalid order number')
  }
}

export function calculatePeriodSalesForecast(
  weekData: WeekData,
  nextWeekData: WeekData | null,
  startDate: Date,
  endDate: Date
): number {
  let totalForecast = 0

  // Current week forecasts
  if (weekData.sales_forecast) {
    totalForecast += Object.entries(weekData.sales_forecast)
      .filter(([date]) => {
        const forecastDate = new Date(date)
        return (
          (isAfter(forecastDate, startDate) || isSameDay(forecastDate, startDate)) &&
          (isBefore(forecastDate, endDate) || isSameDay(forecastDate, endDate))
        )
      })
      .reduce((total, [_, forecast]) => total + forecast, 0)
  }

  // Next week forecasts if needed
  if (nextWeekData?.sales_forecast) {
    totalForecast += Object.entries(nextWeekData.sales_forecast)
      .filter(([date]) => {
        const forecastDate = new Date(date)
        return (
          (isAfter(forecastDate, startDate) || isSameDay(forecastDate, startDate)) &&
          (isBefore(forecastDate, endDate) || isSameDay(forecastDate, endDate))
        )
      })
      .reduce((total, [_, forecast]) => total + forecast, 0)
  }

  return totalForecast
}

export function calculateOrderNeeds(
  order: Order,
  weekData: WeekData,
  nextWeekData: WeekData | null,
  product: Product,
  previousOrders: Order[],
  previousWeekOrders: Order[]
): number {
  // Convert stock from packages to units
  const stockInPackages = order.real_stock?.[product.id!] || 
                          order.theoretical_stock?.[product.id!] || 
                          calculateTheoreticalStock(order, product, previousOrders, previousWeekOrders)
  const stockInUnits = convertToUnits(stockInPackages, product)

  const consumption = calculateConsumption(product, weekData, nextWeekData, order)

  // Retrieve and convert the ordered quantity from the previous order
  let previousOrderedQuantityInUnits = 0
  if (order.order_number === 1) {
    const previousWeekOrder = previousWeekOrders.find(o => o.order_number === 3)
    const previousOrderedQuantityInPackages = getOrderedQuantity(previousWeekOrder, product.id!)
    previousOrderedQuantityInUnits = convertToUnits(previousOrderedQuantityInPackages, product)
  } else {
    const previousOrder = previousOrders.find(o => o.order_number === order.order_number - 1)
    const previousOrderedQuantityInPackages = getOrderedQuantity(previousOrder, product.id!)
    previousOrderedQuantityInUnits = convertToUnits(previousOrderedQuantityInPackages, product)
  }

  // Adjust needs calculation to include previous ordered quantity
  return consumption - stockInUnits - previousOrderedQuantityInUnits
}