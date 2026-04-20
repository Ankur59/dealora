import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiGet, apiPostJson, apiPutJson } from '../lib/api'
import { MERCHANT_FIELDS } from '../config/merchantFields'
import type {
  Merchant,
  MerchantCredentialType,
  MerchantField,
} from '../types/merchant'
import './MerchantsPage.css'

const RECENT_SYNC_HOURS = 24

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function isRecentSync(iso: string | null | undefined, nowMs: number) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const delta = nowMs - d.getTime()
  return delta >= 0 && delta <= RECENT_SYNC_HOURS * 60 * 60 * 1000
}

function buildInitialValues(fields: MerchantField[]) {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = String(field.defaultValue ?? '')
    return acc
  }, {})
}

function coercePayload(values: Record<string, string>, fields: MerchantField[]) {
  const payload: Record<string, string> = {}
  for (const field of fields) {
    payload[field.key] = values[field.key] ?? ''
  }
  return payload
}

function buildCredentialDrafts(merchants: Merchant[]) {
  const drafts: Record<string, Record<'email' | 'phone', { login: string; password: string }>> =
    {}
  for (const merchant of merchants) {
    const email = (merchant.credentials ?? []).find(
      (c) => c.credentialType === 'email_password',
    )
    const phone = (merchant.credentials ?? []).find(
      (c) => c.credentialType === 'phone_password',
    )
    drafts[merchant._id] = {
      email: {
        login: email?.login ?? '',
        password: email?.password ?? '',
      },
      phone: {
        login: phone?.login ?? '',
        password: phone?.password ?? '',
      },
    }
  }
  return drafts
}

function credentialTypeLabel(type: MerchantCredentialType) {
  return type === 'email_password' ? 'Email + Password' : 'Phone + Password'
}

export function MerchantsPage() {
  const [fields] = useState<MerchantField[]>(MERCHANT_FIELDS)
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'all',
  )
  const [syncFilter, setSyncFilter] = useState<'all' | 'recent' | 'never'>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const [credentialDrafts, setCredentialDrafts] = useState<
    Record<string, Record<'email' | 'phone', { login: string; password: string }>>
  >({})
  const [credentialSavingKey, setCredentialSavingKey] = useState<string | null>(null)

  const loadMerchants = useCallback(async () => {
    setListError(null)
    try {
      const data = await apiGet<Merchant[]>('/api/v1/merchants')
      const rows = Array.isArray(data) ? data : []
      setMerchants(rows)
      setCredentialDrafts(buildCredentialDrafts(rows))
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load merchants')
      setMerchants([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setListError(null)
      try {
        const listRes = await apiGet<Merchant[]>('/api/v1/merchants')
        if (cancelled) return
        setFormValues(buildInitialValues(fields))
        const rows = Array.isArray(listRes) ? listRes : []
        setMerchants(rows)
        setCredentialDrafts(buildCredentialDrafts(rows))
      } catch (e) {
        if (!cancelled) {
          setListError(
            e instanceof Error ? e.message : 'Failed to load merchant module',
          )
          setMerchants([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fields])

  const requiredFields = useMemo(
    () => fields.filter((field) => field.required),
    [fields],
  )

  const nowMs = Date.now()

  const syncCounts = useMemo(() => {
    let recent = 0
    let never = 0
    for (const m of merchants) {
      if (isRecentSync(m.lastSyncedCookieAt, nowMs)) recent += 1
      if (!m.lastSyncedCookieAt) never += 1
    }
    return { recent, never }
  }, [merchants, nowMs])

  const filteredMerchants = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    return merchants.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      const hasSync = Boolean(m.lastSyncedCookieAt)
      const recentSync = isRecentSync(m.lastSyncedCookieAt, nowMs)
      if (syncFilter === 'recent' && !recentSync) return false
      if (syncFilter === 'never' && hasSync) return false
      if (!q) return true
      const haystack = [
        m.merchantName,
        m.status,
        m.description ?? '',
        m.website ?? '',
        m.notes ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [merchants, searchInput, statusFilter, syncFilter, nowMs])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    for (const field of requiredFields) {
      if (!String(formValues[field.key] ?? '').trim()) {
        setFormError(`${field.label} is required`)
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = coercePayload(formValues, fields)
      await apiPostJson<Merchant>('/api/v1/merchants', payload)
      setFormSuccess('Merchant created successfully.')
      setFormValues(buildInitialValues(fields))
      await loadMerchants()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create merchant')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(merchant: Merchant) {
    const values = buildInitialValues(fields)
    for (const field of fields) {
      values[field.key] = String((merchant as Record<string, unknown>)[field.key] ?? '')
    }
    setEditValues(values)
    setEditingId(merchant._id)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setEditError(null)
    for (const field of requiredFields) {
      if (!String(editValues[field.key] ?? '').trim()) {
        setEditError(`${field.label} is required`)
        return
      }
    }
    setSavingEdit(true)
    try {
      const payload = coercePayload(editValues, fields)
      await apiPutJson<Merchant>(`/api/v1/merchants/${editingId}`, payload)
      setEditingId(null)
      setEditValues({})
      await loadMerchants()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update merchant')
    } finally {
      setSavingEdit(false)
    }
  }

  async function toggleMerchantStatus(id: string, nextStatus: 'active' | 'inactive') {
    const ok = window.confirm(
      nextStatus === 'inactive'
        ? 'Mark this merchant as inactive? The record will be kept.'
        : 'Mark this merchant as active?',
    )
    if (!ok) return
    setStatusChangingId(id)
    setListError(null)
    try {
      await apiPutJson<Merchant>(
        `/api/v1/merchants/${id}/${nextStatus === 'inactive' ? 'deactivate' : 'activate'}`,
        {},
      )
      if (editingId === id) {
        setEditingId(null)
        setEditValues({})
      }
      await loadMerchants()
    } catch (e) {
      setListError(
        e instanceof Error
          ? e.message
          : `Failed to mark merchant ${nextStatus === 'inactive' ? 'inactive' : 'active'}`,
      )
    } finally {
      setStatusChangingId(null)
    }
  }

  async function saveCredential(
    merchantId: string,
    type: MerchantCredentialType,
    login: string,
    password: string,
  ) {
    const trimmedLogin = login.trim()
    const trimmedPassword = password.trim()
    if (!trimmedLogin || !trimmedPassword) {
      setListError('Credential login and password are required')
      return
    }

    const key = `${merchantId}:${type}`
    setCredentialSavingKey(key)
    setListError(null)
    try {
      await apiPutJson(`/api/v1/merchants/${merchantId}/credentials/${type}`, {
        login: trimmedLogin,
        password: trimmedPassword,
      })
      await loadMerchants()
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to save credential')
    } finally {
      setCredentialSavingKey(null)
    }
  }

  return (
    <div className="merchants-page">
      <h1 className="merchants-page-title">Merchants</h1>
      <p className="merchants-page-lead">
        Manage the <code>merchant</code> collection. Form fields are driven from
        one frontend config file for easy future updates.
      </p>

      <section className="merchants-form-section" aria-labelledby="add-merchant-h">
        <h2 id="add-merchant-h" className="merchants-section-title">
          Create merchant
        </h2>
        <form className="merchants-form" onSubmit={(e) => void onCreate(e)}>
          {fields.map((field) => (
            <label className="merchants-label" key={`create-${field.key}`}>
              {field.label}
              {field.required ? <span className="merchants-req"> *</span> : null}
              {field.kind === 'enum' ? (
                <select
                  className="merchants-input"
                  value={formValues[field.key] ?? ''}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                >
                  {(field.options ?? []).map((opt) => (
                    <option key={`${field.key}-${opt}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.maxLength && field.maxLength > 250 ? (
                <textarea
                  className="merchants-textarea"
                  rows={3}
                  value={formValues[field.key] ?? ''}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  maxLength={field.maxLength}
                />
              ) : (
                <input
                  className="merchants-input"
                  value={formValues[field.key] ?? ''}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  maxLength={field.maxLength}
                  required={Boolean(field.required)}
                />
              )}
            </label>
          ))}

          {formError ? <p className="merchants-msg merchants-msg--error">{formError}</p> : null}
          {formSuccess ? (
            <p className="merchants-msg merchants-msg--ok">{formSuccess}</p>
          ) : null}
          <button className="merchants-submit" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save merchant'}
          </button>
        </form>
      </section>

      <section className="merchants-list-section" aria-labelledby="merchants-list-h">
        <h2 id="merchants-list-h" className="merchants-section-title">
          Existing merchants
        </h2>
        <label className="merchants-search">
          Search merchants
          <input
            className="merchants-input"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name, status, website, notes..."
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="merchants-status-chips" role="group" aria-label="Filter by status">
          <button
            type="button"
            className={`merchants-chip${
              statusFilter === 'all' ? ' merchants-chip--active' : ''
            }`}
            onClick={() => setStatusFilter('all')}
          >
            All ({merchants.length})
          </button>
          <button
            type="button"
            className={`merchants-chip${
              statusFilter === 'active' ? ' merchants-chip--active' : ''
            }`}
            onClick={() => setStatusFilter('active')}
          >
            Active ({merchants.filter((m) => m.status === 'active').length})
          </button>
          <button
            type="button"
            className={`merchants-chip${
              statusFilter === 'inactive' ? ' merchants-chip--active' : ''
            }`}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactive ({merchants.filter((m) => m.status === 'inactive').length})
          </button>
        </div>
        <div className="merchants-status-chips" role="group" aria-label="Filter by sync recency">
          <button
            type="button"
            className={`merchants-chip${
              syncFilter === 'all' ? ' merchants-chip--active' : ''
            }`}
            onClick={() => setSyncFilter('all')}
          >
            All sync states
          </button>
          <button
            type="button"
            className={`merchants-chip${
              syncFilter === 'recent' ? ' merchants-chip--active' : ''
            }`}
            onClick={() => setSyncFilter('recent')}
          >
            Recently synced ({syncCounts.recent})
          </button>
          <button
            type="button"
            className={`merchants-chip${
              syncFilter === 'never' ? ' merchants-chip--active' : ''
            }`}
            onClick={() => setSyncFilter('never')}
          >
            Never synced ({syncCounts.never})
          </button>
        </div>
        <p className="merchants-filter-hint">
          Recently synced means synced in the last {RECENT_SYNC_HOURS} hours.
          Times are shown in your local timezone.
        </p>
        {loading ? <p className="merchants-muted">Loading…</p> : null}
        {listError ? <p className="merchants-msg merchants-msg--error">{listError}</p> : null}
        {!loading && !listError && merchants.length === 0 ? (
          <p className="merchants-muted">No merchants yet. Create one above.</p>
        ) : null}
        {!loading && !listError && merchants.length > 0 && filteredMerchants.length === 0 ? (
          <p className="merchants-muted">No merchants match this search.</p>
        ) : null}

        <ul className="merchants-cards">
          {filteredMerchants.map((merchant) => {
            const isEditing = editingId === merchant._id
            return (
              <li key={merchant._id} className="merchant-card">
                <div className="merchant-card-head">
                  <span className="merchant-card-name">{merchant.merchantName}</span>
                  <span
                    className={`merchant-card-status merchant-card-status--${merchant.status}`}
                  >
                    {merchant.status}
                  </span>
                </div>

                {isEditing ? (
                  <div className="merchant-edit-grid">
                    {fields.map((field) => (
                      <label className="merchants-label" key={`edit-${merchant._id}-${field.key}`}>
                        {field.label}
                        {field.kind === 'enum' ? (
                          <select
                            className="merchants-input"
                            value={editValues[field.key] ?? ''}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                          >
                            {(field.options ?? []).map((opt) => (
                              <option key={`${merchant._id}-${field.key}-${opt}`} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.maxLength && field.maxLength > 250 ? (
                          <textarea
                            className="merchants-textarea"
                            rows={3}
                            value={editValues[field.key] ?? ''}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            maxLength={field.maxLength}
                          />
                        ) : (
                          <input
                            className="merchants-input"
                            value={editValues[field.key] ?? ''}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            maxLength={field.maxLength}
                          />
                        )}
                      </label>
                    ))}
                    {editError ? (
                      <p className="merchants-msg merchants-msg--error">{editError}</p>
                    ) : null}
                    <div className="merchant-card-actions">
                      <button
                        type="button"
                        className="merchants-submit"
                        onClick={() => void saveEdit()}
                        disabled={savingEdit}
                      >
                        {savingEdit ? 'Saving…' : 'Update merchant'}
                      </button>
                      <button
                        type="button"
                        className="merchants-submit merchants-submit--ghost"
                        onClick={() => {
                          setEditingId(null)
                          setEditValues({})
                          setEditError(null)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {merchant.description ? (
                      <p className="merchant-card-desc">{merchant.description}</p>
                    ) : null}
                    {merchant.website ? (
                      <a
                        className="merchant-card-link"
                        href={merchant.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {merchant.website}
                      </a>
                    ) : null}
                    {merchant.notes ? (
                      <p className="merchant-card-notes">{merchant.notes}</p>
                    ) : null}
                    <p className="merchant-card-meta">
                      Last synced cookie: {formatDate(merchant.lastSyncedCookieAt ?? undefined)}
                    </p>
                    <p className="merchant-card-meta">
                      Updated {formatDate(merchant.updatedAt)}
                    </p>
                    <div className="merchant-credentials">
                      <p className="merchant-credentials-title">Credentials</p>
                      <div className="merchant-credential-block">
                        <p className="merchant-credential-type">
                          {credentialTypeLabel('email_password')}
                        </p>
                        <div className="merchant-credential-inputs">
                          <input
                            className="merchants-input"
                            placeholder="Email"
                            value={credentialDrafts[merchant._id]?.email.login ?? ''}
                            onChange={(e) =>
                              setCredentialDrafts((prev) => ({
                                ...prev,
                                [merchant._id]: {
                                  ...(prev[merchant._id] ?? {
                                    email: { login: '', password: '' },
                                    phone: { login: '', password: '' },
                                  }),
                                  email: {
                                    ...(prev[merchant._id]?.email ?? {
                                      login: '',
                                      password: '',
                                    }),
                                    login: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                          <input
                            className="merchants-input"
                            placeholder="Password"
                            value={credentialDrafts[merchant._id]?.email.password ?? ''}
                            onChange={(e) =>
                              setCredentialDrafts((prev) => ({
                                ...prev,
                                [merchant._id]: {
                                  ...(prev[merchant._id] ?? {
                                    email: { login: '', password: '' },
                                    phone: { login: '', password: '' },
                                  }),
                                  email: {
                                    ...(prev[merchant._id]?.email ?? {
                                      login: '',
                                      password: '',
                                    }),
                                    password: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="merchants-submit"
                            disabled={credentialSavingKey === `${merchant._id}:email_password`}
                            onClick={() =>
                              void saveCredential(
                                merchant._id,
                                'email_password',
                                credentialDrafts[merchant._id]?.email.login ?? '',
                                credentialDrafts[merchant._id]?.email.password ?? '',
                              )
                            }
                          >
                            {credentialSavingKey === `${merchant._id}:email_password`
                              ? 'Saving...'
                              : 'Save'}
                          </button>
                        </div>
                        {merchant.credentials?.find(
                          (c) => c.credentialType === 'email_password',
                        ) ? (
                          <p className="merchant-credential-meta">
                            Saved:{' '}
                            {merchant.credentials?.find(
                              (c) => c.credentialType === 'email_password',
                            )?.login}{' '}
                            /{' '}
                            {
                              merchant.credentials?.find(
                                (c) => c.credentialType === 'email_password',
                              )?.password
                            }{' '}
                            · updated{' '}
                            {formatDate(
                              merchant.credentials?.find(
                                (c) => c.credentialType === 'email_password',
                              )?.updatedAt ?? undefined,
                            )}
                          </p>
                        ) : (
                          <p className="merchant-credential-meta">
                            Not saved yet
                          </p>
                        )}
                      </div>

                      <div className="merchant-credential-block">
                        <p className="merchant-credential-type">
                          {credentialTypeLabel('phone_password')}
                        </p>
                        <div className="merchant-credential-inputs">
                          <input
                            className="merchants-input"
                            placeholder="Phone"
                            value={credentialDrafts[merchant._id]?.phone.login ?? ''}
                            onChange={(e) =>
                              setCredentialDrafts((prev) => ({
                                ...prev,
                                [merchant._id]: {
                                  ...(prev[merchant._id] ?? {
                                    email: { login: '', password: '' },
                                    phone: { login: '', password: '' },
                                  }),
                                  phone: {
                                    ...(prev[merchant._id]?.phone ?? {
                                      login: '',
                                      password: '',
                                    }),
                                    login: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                          <input
                            className="merchants-input"
                            placeholder="Password"
                            value={credentialDrafts[merchant._id]?.phone.password ?? ''}
                            onChange={(e) =>
                              setCredentialDrafts((prev) => ({
                                ...prev,
                                [merchant._id]: {
                                  ...(prev[merchant._id] ?? {
                                    email: { login: '', password: '' },
                                    phone: { login: '', password: '' },
                                  }),
                                  phone: {
                                    ...(prev[merchant._id]?.phone ?? {
                                      login: '',
                                      password: '',
                                    }),
                                    password: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="merchants-submit"
                            disabled={credentialSavingKey === `${merchant._id}:phone_password`}
                            onClick={() =>
                              void saveCredential(
                                merchant._id,
                                'phone_password',
                                credentialDrafts[merchant._id]?.phone.login ?? '',
                                credentialDrafts[merchant._id]?.phone.password ?? '',
                              )
                            }
                          >
                            {credentialSavingKey === `${merchant._id}:phone_password`
                              ? 'Saving...'
                              : 'Save'}
                          </button>
                        </div>
                        {merchant.credentials?.find(
                          (c) => c.credentialType === 'phone_password',
                        ) ? (
                          <p className="merchant-credential-meta">
                            Saved:{' '}
                            {merchant.credentials?.find(
                              (c) => c.credentialType === 'phone_password',
                            )?.login}{' '}
                            /{' '}
                            {
                              merchant.credentials?.find(
                                (c) => c.credentialType === 'phone_password',
                              )?.password
                            }{' '}
                            · updated{' '}
                            {formatDate(
                              merchant.credentials?.find(
                                (c) => c.credentialType === 'phone_password',
                              )?.updatedAt ?? undefined,
                            )}
                          </p>
                        ) : (
                          <p className="merchant-credential-meta">
                            Not saved yet
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="merchant-card-actions">
                      <button
                        type="button"
                        className="merchants-submit merchants-submit--ghost"
                        onClick={() => startEdit(merchant)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="merchants-submit merchants-submit--danger"
                        onClick={() =>
                          void toggleMerchantStatus(
                            merchant._id,
                            merchant.status === 'active' ? 'inactive' : 'active',
                          )
                        }
                        disabled={statusChangingId === merchant._id}
                      >
                        {statusChangingId === merchant._id
                          ? merchant.status === 'active'
                            ? 'Making inactive…'
                            : 'Making active…'
                          : merchant.status === 'active'
                            ? 'Make inactive'
                            : 'Make active'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
