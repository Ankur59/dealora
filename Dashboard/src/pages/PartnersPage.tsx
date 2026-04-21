import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiPostJson } from '../lib/api'
import type { Partner } from '../types/partner'
import './PartnersPage.css'

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [partnerName, setPartnerName] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const loadPartners = useCallback(async () => {
    setListError(null)
    setLoading(true)
    try {
      const data = await apiGet<Partner[]>('/api/v1/partners')
      setPartners(Array.isArray(data) ? data : [])
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load partners')
      setPartners([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPartners()
  }, [loadPartners])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    setSubmitting(true)
    try {
      await apiPostJson<Partner>('/api/v1/partners', {
        partnerName: partnerName.trim(),
        status,
        description: description.trim(),
        website: website.trim(),
        notes: notes.trim(),
        partnerApis: [],
      })
      setFormSuccess(`Partner “${partnerName.trim()}” saved.`)
      setPartnerName('')
      setDescription('')
      setWebsite('')
      setNotes('')
      setStatus('active')
      await loadPartners()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save partner')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="partners-page">
      <h1 className="partners-page-title">Partners</h1>
      <p className="partners-page-lead">
        Add a partner record in MongoDB. API integrations can be configured later
        from the engine.
      </p>

      <section className="partners-form-section" aria-labelledby="add-partner-h">
        <h2 id="add-partner-h" className="partners-section-title">
          Add partner
        </h2>
        <form className="partners-form" onSubmit={(e) => void onSubmit(e)}>
          <label className="partners-label">
            Partner name <span className="partners-req">*</span>
            <input
              className="partners-input"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g. admitad"
              autoComplete="off"
            />
          </label>
          <label className="partners-label">
            Status
            <select
              className="partners-input"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value === 'inactive' ? 'inactive' : 'active')
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="partners-label">
            Description
            <textarea
              className="partners-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Short description for the team"
            />
          </label>
          <label className="partners-label">
            Website
            <input
              className="partners-input"
              type="text"
              inputMode="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={500}
              placeholder="https://"
            />
          </label>
          <label className="partners-label">
            Internal notes
            <textarea
              className="partners-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Optional ops notes"
            />
          </label>
          {formError ? <p className="partners-msg partners-msg--error">{formError}</p> : null}
          {formSuccess ? (
            <p className="partners-msg partners-msg--ok">{formSuccess}</p>
          ) : null}
          <button className="partners-submit" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save partner'}
          </button>
        </form>
      </section>

      <section className="partners-list-section" aria-labelledby="partners-list-h">
        <h2 id="partners-list-h" className="partners-section-title">
          All partners
        </h2>
        {loading ? <p className="partners-muted">Loading…</p> : null}
        {listError ? <p className="partners-msg partners-msg--error">{listError}</p> : null}
        {!loading && !listError && partners.length === 0 ? (
          <p className="partners-muted">No partners yet. Add one above.</p>
        ) : null}
        <ul className="partners-cards">
          {partners.map((p) => (
            <li key={p._id} className="partner-card">
              <div className="partner-card-head">
                <span className="partner-card-name">{p.partnerName}</span>
                <span
                  className={`partner-card-status partner-card-status--${p.status}`}
                >
                  {p.status}
                </span>
              </div>
              {p.description ? (
                <p className="partner-card-desc">{p.description}</p>
              ) : (
                <p className="partner-card-desc partner-card-desc--empty">
                  No description
                </p>
              )}
              {p.website ? (
                <a
                  className="partner-card-link"
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.website}
                </a>
              ) : null}
              <div className="partner-card-meta">
                <span>{p.partnerApis?.length ?? 0} API configs</span>
                <span>Updated {formatDate(p.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
