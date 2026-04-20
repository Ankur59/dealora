export type PartnerCouponRow = {
  id: string
  partner: string
  couponId: string
  code: string | null
  description: string | null
  brandName: string
  status: string | null
  type: string | null
  isVerified: boolean
  verifiedOn: string | null
  countries: string[]
  trackingLink: string | null
  updatedAt: string | null
}

export type CouponListPayload = {
  items: PartnerCouponRow[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}
