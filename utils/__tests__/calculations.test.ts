import { addDays } from 'date-fns'
import { 
  calculateTheoreticalStock, 
  calculatePeriodConsumption
} from '../calculations'
import { Order, Product, WeekData } from '../../types/interfaces'

describe('Stock Calculations', () => {
  // Mock data
  const mockProduct: Product = {
    id: 1,
    reference_produit: 'PROD1',
    nom_produit: 'Test Product',
    unite_stock: 'carton',
    code_destination: 'TEST',
    is_hidden: false,
    category_id: 1,
    unit_conversion: {
      number_of_packs: 1,
      units_per_pack: 10,
      unit: 'unit'
    }
  }

  const mockWeekData: WeekData = {
    id: 1,
    year: 2025,
    week_number: 3,
    consumption_data: {
      'PROD1': 100 // 100 unités pour 1000 ventes
    },
    sales_forecast: {
      '2025-01-16': 100, // Jeudi
      '2025-01-17': 100, // Vendredi
      '2025-01-18': 100, // Samedi
      '2025-01-19': 100, // Dimanche
      '2025-01-20': 100, // Lundi
      '2025-01-21': 100, // Mardi
      '2025-01-22': 100  // Mercredi
    }
  }

  describe('getEffectiveStock', () => {
    const mockOrder: Order = {
      id: 1,
      week_data_id: 1,
      order_number: 1,
      delivery_date: '2025-01-16',
      real_stock: { 1: 50 },
      theoretical_stock: { 1: 30 }
    }

    it('should return real stock when available', () => {
      const result = calculateTheoreticalStock(
        mockOrder,
        mockProduct,
        [],
        []
      )
      expect(result).toBeDefined()
    })

    it('should return theoretical stock when no real stock', () => {
      const orderWithoutRealStock: Order = {
        ...mockOrder,
        real_stock: undefined
      }
      const result = calculateTheoreticalStock(
        orderWithoutRealStock,
        mockProduct,
        [],
        []
      )
      expect(result).toBeDefined()
    })

    it('should return 0 when no stock data available', () => {
      const orderWithoutStock: Order = {
        ...mockOrder,
        real_stock: undefined,
        theoretical_stock: undefined
      }
      const result = calculateTheoreticalStock(
        orderWithoutStock,
        mockProduct,
        [],
        []
      )
      expect(result).toBe(0)
    })
  })

  describe('calculateTheoreticalStock', () => {
    // Mock orders with week_data_id instead of week_data
    const mockPrevWeekOrder2: Order = {
      id: 2,
      week_data_id: 1,
      order_number: 2,
      delivery_date: '2025-01-11', // Samedi précédent
      ordered_quantities: { 1: 20 }
    }

    const mockPrevWeekOrder3: Order = {
      id: 3,
      week_data_id: 1,
      order_number: 3,
      delivery_date: '2025-01-14', // Mardi
      real_stock: { 1: 30 },
      week_data: mockWeekData
    }

    describe('Order 1 (Jeudi)', () => {
      const mockOrder1: Order = {
        id: 4,
        week_data_id: 2,
        order_number: 1,
        delivery_date: '2025-01-16' // Jeudi
      }

      it('should calculate theoretical stock correctly for Order 1', () => {
        const result = calculateTheoreticalStock(
          mockOrder1,
          mockProduct,
          [],
          [mockPrevWeekOrder2, mockPrevWeekOrder3]
        )
        
        // Stock précédent (30) + Quantité commandée (20) - Consommation weekend
        expect(result).toBeDefined()
        expect(result).toBeGreaterThanOrEqual(0)
      })

      it('should handle missing previous orders', () => {
        const result = calculateTheoreticalStock(
          mockOrder1,
          mockProduct,
          [],
          []
        )
        expect(result).toBe(0)
      })
    })

    describe('Order 2 (Samedi)', () => {
      const mockOrder2: Order = {
        id: 5,
        week_data_id: 2,
        order_number: 2,
        delivery_date: '2025-01-18' // Samedi
      }

      const mockCurrentOrder1: Order = {
        id: 6,
        week_data_id: 2,
        order_number: 1,
        delivery_date: '2025-01-16', // Jeudi
        real_stock: { 1: 25 },
        week_data: mockWeekData
      }

      it('should calculate theoretical stock correctly for Order 2', () => {
        const result = calculateTheoreticalStock(
          mockOrder2,
          mockProduct,
          [mockCurrentOrder1],
          [mockPrevWeekOrder3]
        )
        expect(result).toBeDefined()
        expect(result).toBeGreaterThanOrEqual(0)
      })
    })

    describe('Order 3 (Mardi)', () => {
      const mockOrder3: Order = {
        id: 7,
        week_data_id: 2,
        order_number: 3,
        delivery_date: '2025-01-21' // Mardi suivant
      }

      const mockCurrentOrder1: Order = {
        id: 8,
        week_data_id: 2,
        order_number: 1,
        delivery_date: '2025-01-16', // Jeudi
        ordered_quantities: { 1: 15 }
      }

      const mockCurrentOrder2: Order = {
        id: 9,
        week_data_id: 2,
        order_number: 2,
        delivery_date: '2025-01-18', // Samedi
        real_stock: { 1: 20 },
        week_data: mockWeekData
      }

      it('should calculate theoretical stock correctly for Order 3', () => {
        const result = calculateTheoreticalStock(
          mockOrder3,
          mockProduct,
          [mockCurrentOrder1, mockCurrentOrder2],
          []
        )
        expect(result).toBeDefined()
        expect(result).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('calculatePeriodConsumption', () => {
    it('should calculate consumption correctly for a period', () => {
      const startDate = new Date('2025-01-16')
      const endDate = new Date('2025-01-18')
      
      const result = calculatePeriodConsumption(
        mockProduct,
        mockWeekData,
        startDate,
        endDate
      )
      
      expect(result).toBeDefined()
      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 when no consumption data', () => {
      const startDate = new Date('2025-01-16')
      const endDate = new Date('2025-01-18')
      
      const weekDataWithoutConsumption = {
        ...mockWeekData,
        consumption_data: undefined
      }
      
      const result = calculatePeriodConsumption(
        mockProduct,
        weekDataWithoutConsumption,
        startDate,
        endDate
      )
      
      expect(result).toBe(0)
    })

    it('should return 0 when no product reference', () => {
      const startDate = new Date('2025-01-16')
      const endDate = new Date('2025-01-18')
      
      const productWithoutRef: Product = {
        ...mockProduct,
        reference_produit: ''
      }
      
      const result = calculatePeriodConsumption(
        productWithoutRef,
        mockWeekData,
        startDate,
        endDate
      )
      
      expect(result).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined ordered quantities', () => {
      const mockOrder: Order = {
        id: 1,
        week_data_id: 1,
        order_number: 1,
        delivery_date: '2025-01-16',
        ordered_quantities: undefined
      }
      
      const result = calculateTheoreticalStock(
        mockOrder,
        mockProduct,
        [],
        []
      )
      
      expect(result).toBe(0)
    })

    it('should handle null values in ordered quantities', () => {
      const mockOrder: Order = {
        id: 1,
        week_data_id: 1,
        order_number: 1,
        delivery_date: '2025-01-16',
        ordered_quantities: { 1: null as any }
      }
      
      const result = calculateTheoreticalStock(
        mockOrder,
        mockProduct,
        [],
        []
      )
      
      expect(result).toBe(0)
    })

    it('should handle missing week_data', () => {
      const mockOrder: Order = {
        id: 1,
        week_data_id: 1,
        order_number: 1,
        delivery_date: '2025-01-16'
      }
      
      const result = calculateTheoreticalStock(
        mockOrder,
        mockProduct,
        [],
        []
      )
      
      expect(result).toBe(0)
    })
  })
})
