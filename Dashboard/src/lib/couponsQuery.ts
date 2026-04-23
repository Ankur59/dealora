export type CouponFilters = {
  partner: string
  isVerified: '' | 'true' | 'false'
  verifiedFrom: string
  verifiedTo: string
  sortByScore: boolean
}

export function buildCouponsListUrl(
  page: number,
  filters: CouponFilters,
  limit = 20,
) {
  const p = new URLSearchParams()
  p.set('page', String(page))
  p.set('limit', String(limit))
  const partner = filters.partner.trim()
  if (partner) p.set('partner', partner)
  if (filters.isVerified) p.set('isVerified', filters.isVerified)
  if (filters.verifiedFrom.trim())
    p.set('verifiedFrom', filters.verifiedFrom.trim())
  if (filters.verifiedTo.trim()) p.set('verifiedTo', filters.verifiedTo.trim())
  if (filters.sortByScore) p.set('sortByScore', 'true')
  return `/api/v1/coupons?${p.toString()}`
}
