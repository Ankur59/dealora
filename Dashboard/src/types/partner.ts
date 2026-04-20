export type PartnerApi = {
  apiUrl: string
  apiType: string
  targetSchema: string
  apiDescription?: string
}

export type Partner = {
  _id: string
  partnerName: string
  status: 'active' | 'inactive'
  description?: string
  website?: string
  notes?: string
  partnerApis: PartnerApi[]
  createdAt?: string
  updatedAt?: string
}
