import './DashboardHome.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../lib/api'
import type { CouponListPayload, PartnerCouponRow } from '../types/coupon'
import { filterCouponsBySearch } from './couponSearch'

type VerificationStateFilter = '' | 'verified' | 'pending'
type OverviewCounts = { total: number; verified: number; pending: number }

function parseIsoOrNull(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function isVerifiedWithin12h(verifiedAtIso: string | null, nowMs: number) {
  const d = parseIsoOrNull(verifiedAtIso)
  if (!d) return false
  const delta = nowMs - d.getTime()
  return delta >= 0 && delta <= 12 * 60 * 60 * 1000
}

export function DashboardHome() {
  const [partnerOptions, setPartnerOptions] = useState<string[]>([])
  const [provider, setProvider] = useState('')
  const [items, setItems] = useState<PartnerCouponRow[]>([])
  const [totalFromDb, setTotalFromDb] = useState(0)
  const [overviewCounts, setOverviewCounts] = useState<OverviewCounts>({
    total: 0,
    verified: 0,
    pending: 0,
  })
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationStateFilter>('')
  const [verifiedFrom, setVerifiedFrom] = useState('')
  const [verifiedTo, setVerifiedTo] = useState('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meta = await apiGet<{ partners: string[] }>('/api/v1/coupons/partners')
        if (!cancelled) {
          setPartnerOptions(Array.isArray(meta.partners) ? meta.partners : [])
        }
      } catch {
        if (!cancelled) setPartnerOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const fetchPage = useCallback(
    async (pageNum: number) => {
      const p = new URLSearchParams()
      p.set('page', String(pageNum))
      p.set('limit', '50')
      if (provider.trim()) p.set('partner', provider.trim())
      return apiGet<CouponListPayload>(`/api/v1/coupons?${p.toString()}`)
    },
    [provider],
  )

  const fetchOverviewCounts = useCallback(async () => {
    const p = new URLSearchParams()
    if (provider.trim()) p.set('partner', provider.trim())
    const query = p.toString()
    const url = query
      ? `/api/v1/coupons/overview-counts?${query}`
      : '/api/v1/coupons/overview-counts'
    return apiGet<OverviewCounts>(url)
  }, [provider])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchOverviewCounts()
        if (cancelled) return
        setOverviewCounts({
          total: Number.isFinite(Number(data.total)) ? Number(data.total) : 0,
          verified: Number.isFinite(Number(data.verified))
            ? Number(data.verified)
            : 0,
          pending: Number.isFinite(Number(data.pending)) ? Number(data.pending) : 0,
        })
      } catch {
        if (!cancelled) {
          setOverviewCounts({ total: 0, verified: 0, pending: 0 })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchOverviewCounts])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setItems([])
      setTotalFromDb(0)
      setPage(0)
      setHasMore(false)
      try {
        const data = await fetchPage(0)
        if (cancelled) return
        setItems(Array.isArray(data.items) ? data.items : [])
        setTotalFromDb(
          Number.isFinite(Number(data.total)) ? Number(data.total) : 0,
        )
        setPage(Number.isFinite(Number(data.page)) ? Number(data.page) : 0)
        setHasMore(Boolean(data.hasMore))
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load overview')
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const data = await fetchPage(page + 1)
      setItems((prev) => [...prev, ...(Array.isArray(data.items) ? data.items : [])])
      setPage(Number.isFinite(Number(data.page)) ? Number(data.page) : page + 1)
      setHasMore(Boolean(data.hasMore))
      setTotalFromDb(Number.isFinite(Number(data.total)) ? Number(data.total) : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more coupons')
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, loading, loadingMore, page])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      { root: null, rootMargin: '220px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const nowMs = Date.now()

  const filteredItems = useMemo(() => {
    const searched = filterCouponsBySearch(items, searchInput.trim())

    const from = verifiedFrom.trim() ? new Date(verifiedFrom.trim()) : null
    const to = verifiedTo.trim() ? new Date(verifiedTo.trim()) : null
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999)

    return searched.filter((c) => {
      const isVerified = isVerifiedWithin12h(c.verifiedAt, nowMs)

      if (verificationFilter === 'verified' && !isVerified) return false
      if (verificationFilter === 'pending' && isVerified) return false

      if (from && !Number.isNaN(from.getTime())) {
        const v = parseIsoOrNull(c.verifiedAt)
        if (!v || v.getTime() < from.getTime()) return false
      }
      if (to && !Number.isNaN(to.getTime())) {
        const v = parseIsoOrNull(c.verifiedAt)
        if (!v || v.getTime() > to.getTime()) return false
      }

      return true
    })
  }, [items, searchInput, verificationFilter, verifiedFrom, verifiedTo, nowMs])

  return (
    <div className="dash-home">
      <h1 className="dash-home-title">Overview</h1>

      <section className="dash-overview-controls" aria-label="Overview controls">
        <label className="dash-field">
          Provider
          <select
            className="dash-input"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">All providers</option>
            {partnerOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="dash-field dash-field--search">
          Search loaded coupons
          <input
            className="dash-input"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Brand, code, provider, country, description…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="dash-field">
          Verification status
          <select
            className="dash-input"
            value={verificationFilter}
            onChange={(e) =>
              setVerificationFilter(
                e.target.value === 'verified' || e.target.value === 'pending'
                  ? e.target.value
                  : '',
              )
            }
          >
            <option value="">All</option>
            <option value="verified">Verified (≤ 12h)</option>
            <option value="pending">Verification pending</option>
          </select>
        </label>

        <label className="dash-field">
          Verified at or after
          <input
            className="dash-input"
            type="date"
            value={verifiedFrom}
            onChange={(e) => setVerifiedFrom(e.target.value)}
          />
        </label>

        <label className="dash-field">
          Verified at or before
          <input
            className="dash-input"
            type="date"
            value={verifiedTo}
            onChange={(e) => setVerifiedTo(e.target.value)}
          />
        </label>
      </section>

      <section className="dash-overview-summary" aria-label="Overview summary">
        <div className="dash-summary-card">
          <div className="dash-summary-kpi">
            {overviewCounts.total.toLocaleString()}
          </div>
          <div className="dash-summary-label">Total coupons (DB)</div>
        </div>
        <div className="dash-summary-card">
          <div className="dash-summary-kpi dash-summary-kpi--good">
            {overviewCounts.verified.toLocaleString()}
          </div>
          <div className="dash-summary-label">Verified (≤ 12h)</div>
        </div>
        <div className="dash-summary-card">
          <div className="dash-summary-kpi">
            {overviewCounts.pending.toLocaleString()}
          </div>
          <div className="dash-summary-label">Verification pending</div>
        </div>
      </section>

      {error ? <p className="dash-error">{error}</p> : null}

      <p className="dash-home-lead">
        Verified state on this screen is computed from <code>verifiedAt</code>.
        If <code>verifiedAt</code> is within 12 hours of “now”, the coupon is
        treated as verified; otherwise it shows as verification pending.
      </p>
      <p className="dash-home-lead">
        Loaded {items.length.toLocaleString()} of {totalFromDb.toLocaleString()}{' '}
        coupon cards. Scroll to load more.
      </p>

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : filteredItems.length === 0 ? (
        <p className="dash-empty">No coupons match these filters.</p>
      ) : (
        <ul className="dash-overview-list">
          {filteredItems.map((c) => {
            const isRecent = isVerifiedWithin12h(c.verifiedAt, nowMs)
            return (
              <li key={c.id} className="dash-coupon-row">
                <div className="dash-coupon-top">
                  <div className="dash-coupon-main">
                    <span className="dash-coupon-brand">{c.brandName}</span>
                    <span
                      className={`dash-verify-pill dash-verify-pill--${
                        isRecent ? 'yes' : 'no'
                      }`}
                    >
                      {isRecent ? 'Verified' : 'Verification pending'}
                    </span>
                  </div>
                  <div className="dash-provider-inline">
                    <span className="dash-provider-label">Provider</span>
                    <span className="dash-provider-value">{c.partner}</span>
                  </div>
                </div>

                <div className="dash-coupon-meta">
                  <span className="dash-coupon-meta-item">
                    Verified at: {formatWhen(c.verifiedAt)}
                  </span>
                  <span className="dash-coupon-meta-item">
                    Updated: {formatWhen(c.updatedAt)}
                  </span>
                  <span className="dash-coupon-meta-item">Coupon ID {c.couponId}</span>
                </div>

                {c.code ? (
                  <p className="dash-coupon-code">
                    Code: <code>{c.code}</code>
                  </p>
                ) : null}
                {c.description ? (
                  <p className="dash-coupon-desc">{c.description}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <div ref={sentinelRef} className="dash-sentinel" aria-hidden="true" />
      {loadingMore ? (
        <p className="dash-loading-more">Loading more coupons…</p>
      ) : null}
    </div>
  )
}
