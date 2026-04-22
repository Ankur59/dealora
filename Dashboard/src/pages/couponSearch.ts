import type { PartnerCouponRow } from '../types/coupon'

export function couponMatchesSearch(c: PartnerCouponRow, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true

  const parts = [
    c.partner,
    c.brandName,
    c.couponId,
    c.code ?? '',
    c.description ?? '',
    c.status ?? '',
    c.type ?? '',
    ...(c.countries ?? []),
  ]

  const haystack = parts.join(' ').toLowerCase()
  return haystack.includes(needle)
}

export function filterCouponsBySearch(
  list: PartnerCouponRow[],
  q: string,
): PartnerCouponRow[] {
  const trimmed = q.trim()
  if (!trimmed) return list
  return list.filter((c) => couponMatchesSearch(c, trimmed))
}
