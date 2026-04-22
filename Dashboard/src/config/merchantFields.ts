import type { MerchantField } from '../types/merchant'

export const MERCHANT_FIELDS: MerchantField[] = [
  {
    key: 'merchantName',
    label: 'Merchant name',
    kind: 'string',
    required: true,
    maxLength: 200,
    defaultValue: '',
  },
  {
    key: 'status',
    label: 'Status',
    kind: 'enum',
    required: true,
    options: ['active', 'inactive'],
    defaultValue: 'active',
  },
  {
    key: 'description',
    label: 'Description',
    kind: 'string',
    maxLength: 4000,
    defaultValue: '',
  },
  {
    key: 'website',
    label: 'Website',
    kind: 'string',
    maxLength: 500,
    defaultValue: '',
  },
  {
    key: 'notes',
    label: 'Notes',
    kind: 'string',
    maxLength: 4000,
    defaultValue: '',
  },
]
