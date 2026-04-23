export type MerchantStatus = 'active' | 'inactive'
export type MerchantCredentialType = 'email_password' | 'phone_password'

export type MerchantCredential = {
  id: string
  credentialType: MerchantCredentialType
  login: string
  password: string
  updatedAt?: string | null
}

export type Merchant = {
  _id: string
  merchantName: string
  status: MerchantStatus
  description?: string
  website?: string
  notes?: string
  lastSyncedCookieAt?: string | null
  credentials?: MerchantCredential[]
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
