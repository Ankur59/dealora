import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiGet, apiPostJson } from '../lib/api'
import { buildCouponsListUrl, type CouponFilters } from '../lib/couponsQuery'
import type { CouponListPayload, PartnerCouponRow } from '../types/coupon'
import { filterCouponsBySearch } from './couponSearch'
import './CouponsPage.css'

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function CouponsPage() {
  const [partnerInput, setPartnerInput] = useState('')
  const deferredPartner = useDeferredValue(partnerInput)
  const [isVerified, setIsVerified] = useState<CouponFilters['isVerified']>('')
  const [verifiedFrom, setVerifiedFrom] = useState('')
  const [verifiedTo, setVerifiedTo] = useState('')
  const [sortByScore, setSortByScore] = useState(true)

  const [partnerOptions, setPartnerOptions] = useState<string[]>([])
  const [items, setItems] = useState<PartnerCouponRow[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [overridingId, setOverridingId] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 400)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  const displayedItems = useMemo(
    () => filterCouponsBySearch(items, debouncedSearch),
    [items, debouncedSearch],
  )

  const searchPending = searchInput.trim() !== debouncedSearch

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const pageRef = useRef(0)

  useEffect(() => {
    pageRef.current = page
  }, [page])

  const filters = useMemo<CouponFilters>(
    () => ({
      partner: deferredPartner,
      isVerified,
      verifiedFrom,
      verifiedTo,
      sortByScore,
    }),
    [deferredPartner, isVerified, verifiedFrom, verifiedTo, sortByScore],
  )

  const fetchPage = useCallback(
    async (pageNum: number, mode: 'replace' | 'append') => {
      const url = buildCouponsListUrl(pageNum, filters, 20)
      const data = await apiGet<CouponListPayload>(url)
      if (mode === 'replace') {
        setItems(data.items)
      } else {
        setItems((prev) => [...prev, ...data.items])
      }
      setPage(data.page)
      setTotal(data.total)
      setHasMore(data.hasMore)
    },
    [filters],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      setLoading(true)
      try {
        const meta = await apiGet<{ partners: string[] }>(
          '/api/v1/coupons/partners',
        )
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      setLoading(true)
      setItems([])
      setPage(0)
      pageRef.current = 0
      setHasMore(false)
      setTotal(0)
      try {
        await fetchPage(0, 'replace')
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load coupons')
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
    if (!hasMore || loading || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setError(null)
    try {
      const nextPage = pageRef.current + 1
      await fetchPage(nextPage, 'append')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, loading])

  const handleOverride = useCallback(async (couponDbId: string, newStatus: 'verified' | 'failed') => {
    if (overridingId) return
    setOverridingId(couponDbId)
    try {
      await apiPostJson(`/api/v1/automation/verification-override/coupon/${couponDbId}`, {
        newStatus,
        reason: 'Manual fleet override from Coupons Page'
      })
      // Update local state to reflect the override
      setItems(prev => prev.map(c => 
        c.id === couponDbId 
          ? { ...c, isVerified: newStatus === 'verified', verifiedOn: new Date().toISOString() } 
          : c
      ))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save override')
    } finally {
      setOverridingId(null)
    }
  }, [overridingId])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (hit) void loadMore()
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore, hasMore, loading])

  return (
    <div className="coupons-page">
      <h1 className="coupons-page-title">Coupons</h1>
      <p className="coupons-page-lead">
        Partner coupon collection (<code>partnercoupons</code>). Filters apply
        to the full set; results load 20 at a time as you scroll. Search only
        narrows coupons already loaded in the browser.
      </p>

      <div className="coupons-search-block">
        <label className="coupons-field coupons-field--search">
          Search loaded coupons
          <input
            className="coupons-input coupons-input--search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Brand, code, partner, country, description…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {searchPending ? (
          <p className="coupons-search-status">Applying search…</p>
        ) : null}
        {debouncedSearch ? (
          <p className="coupons-search-hint">
            Matches are filtered from the {items.length} coupon
            {items.length === 1 ? '' : 's'} currently loaded. Scroll to load more
            from the server, or clear search to see everything loaded.
          </p>
        ) : null}
      </div>

      <section className="coupons-filters" aria-label="Coupon filters">
        <label className="coupons-field">
          Partner name
          <input
            className="coupons-input"
            list="coupon-partner-options"
            value={partnerInput}
            onChange={(e) => setPartnerInput(e.target.value)}
            placeholder="Substring match, e.g. admitad"
            autoComplete="off"
          />
          <datalist id="coupon-partner-options">
            {partnerOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="coupons-field">
          Verified
          <select
            className="coupons-input"
            value={isVerified}
            onChange={(e) =>
              setIsVerified(
                e.target.value === 'true' || e.target.value === 'false'
                  ? e.target.value
                  : '',
              )
            }
          >
            <option value="">All</option>
            <option value="true">Verified</option>
            <option value="false">Not verified</option>
          </select>
        </label>
        <label className="coupons-field">
          Verified on or after
          <input
            className="coupons-input"
            type="date"
            value={verifiedFrom}
            onChange={(e) => setVerifiedFrom(e.target.value)}
          />
        </label>
        <label className="coupons-field">
          Verified on or before
          <input
            className="coupons-input"
            type="date"
            value={verifiedTo}
            onChange={(e) => setVerifiedTo(e.target.value)}
          />
        </label>
        <label className="coupons-field coupons-field--checkbox">
          <input
            type="checkbox"
            checked={sortByScore}
            onChange={(e) => setSortByScore(e.target.checked)}
          />
          Sort by AI Score
        </label>
      </section>

      {error ? <p className="coupons-error">{error}</p> : null}

      <p className="coupons-count" aria-live="polite">
        {loading
          ? 'Loading…'
          : debouncedSearch
            ? `${displayedItems.length} shown · ${items.length} loaded · ${total.toLocaleString()} from filters`
            : `${total.toLocaleString()} from filters · ${items.length} loaded`}
      </p>

      {!loading &&
      debouncedSearch &&
      items.length > 0 &&
      displayedItems.length === 0 ? (
        <p className="coupons-empty-search">
          {`No loaded coupons match "${debouncedSearch}". Try other words or scroll to load more rows, then search again.`}
        </p>
      ) : null}

      <ul className="coupons-list">
        {displayedItems.map((c) => (
          <li key={c.id} className="coupon-card">
            <div className="coupon-card-top">
              <span className="coupon-brand">{c.brandName}</span>
              <div className="coupon-card-top-right">
                <span className="coupon-partner-pill">{c.partner}</span>
                {c.finalScore !== undefined && (
                  <span className="coupon-score-pill" title={`Success: ${c.liveSuccessRate}% | Recency: ${c.recencyScore} | Credibility: ${c.sourceCredibilityScore}`}>
                    ⭐ {c.finalScore}
                  </span>
                )}
              </div>
            </div>
            <div className="coupon-meta-row">
              <span
                className={`coupon-verified coupon-verified--${
                  c.isVerified ? 'yes' : 'no'
                }`}
              >
                {c.isVerified ? 'Verified' : 'Not verified'}
              </span>
              <span className="coupon-verified-date">
                Last verified: {formatWhen(c.verifiedOn)}
              </span>
              <div className="coupon-override-actions">
                <button 
                  className={`override-btn override-btn--valid ${c.isVerified ? 'active' : ''}`}
                  onClick={() => handleOverride(c.id, 'verified')}
                  disabled={overridingId === c.id}
                  title="Human Override: Mark Valid"
                >
                  ✓ Valid
                </button>
                <button 
                  className={`override-btn override-btn--invalid ${!c.isVerified && c.verifiedOn ? 'active' : ''}`}
                  onClick={() => handleOverride(c.id, 'failed')}
                  disabled={overridingId === c.id}
                  title="Human Override: Mark Invalid"
                >
                  ✗ Invalid
                </button>
              </div>
            </div>
            {c.code ? (
              <p className="coupon-code">
                Code: <code>{c.code}</code>
              </p>
            ) : null}
            {c.description ? (
              <p className="coupon-desc">{c.description}</p>
            ) : null}
            <div className="coupon-countries">
              <span className="coupon-countries-label">Countries</span>
              {c.countries.length === 0 ? (
                <span className="coupon-countries-empty">None listed</span>
              ) : (
                <ul className="coupon-country-chips">
                  {c.countries.map((co) => (
                    <li key={`${c.id}-${co}`} className="coupon-country-chip">
                      {co}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="coupon-footer">
              Coupon ID {c.couponId}
              {c.status ? ` · ${c.status}` : ''}
              {c.updatedAt ? ` · updated ${formatWhen(c.updatedAt)}` : ''}
            </p>
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} className="coupons-sentinel" aria-hidden="true" />

      {loadingMore ? (
        <p className="coupons-more">Loading more…</p>
      ) : !hasMore && items.length > 0 ? (
        <p className="coupons-more coupons-more--end">End of results</p>
      ) : null}
    </div>
  )
}
