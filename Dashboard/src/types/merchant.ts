export type MerchantStatus = 'active' | 'inactive'

export type Merchant = {
  _id: string
  merchantName: string
  status: MerchantStatus
  description?: string
  website?: string
  notes?: string
  lastSyncedCookieAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type MerchantField = {
  key: string
  label: string
  kind: 'string' | 'enum'
  required?: boolean
  options?: string[]
  maxLength?: number
  defaultValue?: string
}
