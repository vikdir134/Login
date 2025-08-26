import api from './axios'

export const getEffectivePrice = async ({ customerId, productId, date }) => {
  const params = { customerId, productId }
  if (date) params.date = date
  try {
    const { data } = await api.get('/api/prices/effective', { params })
    return {
      price: Number(data?.price || 0),
      currency: data?.currency || 'PEN'
    }
  } catch {
    return { price: 0, currency: 'PEN' }
  }
}
