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
  verifiedAt: string | null
  countries: string[]
  trackingLink: string | null
  updatedAt: string | null
  finalScore?: number
  liveSuccessRate?: number
  recencyScore?: number
  failureRate?: number
  confidenceScore?: number
  sourceCredibilityScore?: number
}

export type CouponListPayload = {
  items: PartnerCouponRow[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}
