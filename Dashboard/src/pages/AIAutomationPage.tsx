import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../config/socket';
import { apiDelete, apiGet, apiPostJson } from '../lib/api';
import './AIAutomationPage.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Merchant {
  _id: string;
  merchantName: string;
  website: string;
  status: 'active' | 'inactive';
  autoVerificationEnabled?: boolean;
  lastLoginAttempt?: {
    status: 'idle' | 'running' | 'pending_otp' | 'success' | 'failed';
    message?: string;
    lastAttempted?: string;
  };
}

interface VerificationJob {
  _id: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  cycleStartTime: string;
  cycleEndTime?: string;
  totalMerchants: number;
  processedMerchants: number;
  totalCoupons: number;
  verifiedCount: number;
  failedCount: number;
  skippedCount?: number;
}

interface SessionStatus {
  merchantId: string;
  merchantName: string;
  cookieCount: number;
  hasSavedCookies: boolean;
  hasActiveBrowserSession: boolean;
  lastLoginAttempt: {
    status: 'idle' | 'running' | 'pending_otp' | 'success' | 'failed';
    message?: string;
    lastAttempted?: string;
  };
  actionMapCount: number;
}

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

type AutomationMode = 'login' | 'create_account';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    idle: { label: 'Idle', cls: 'badge--idle' },
    running: { label: '⚙ Running', cls: 'badge--running' },
    pending_otp: { label: '🔒 OTP Required', cls: 'badge--otp' },
    success: { label: '✅ Success', cls: 'badge--success' },
    failed: { label: '❌ Failed', cls: 'badge--failed' },
  };
  const s = map[status] ?? map['idle'];
  return <span className={`ai-badge ${s.cls}`}>{s.label}</span>;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AutomationNotification {
  id: string;
  merchantId: string;
  merchantName: string;
  type: 'otp_required' | 'error' | 'success';
  message: string;
  timestamp: Date;
  data?: any;
}

interface ModelMetrics {
  total: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  manualOverrideCount: number;
  confidenceDistribution: Record<string, number>;
  statusBreakdown: Record<string, number>;
  averageAttempts: number;
  errorTypeBreakdown: Record<string, number>;
  computedAt: string;
}

interface MerchantHealth {
  merchantId: string;
  merchantName: string;
  healthScore: number;
  breakdown: Record<string, number>;
  activeCoupons: number;
  verifiedCoupons: number;
  totalVerifications: number;
  computedAt: string;
}

interface HealthData {
  systemHealth: number;
  merchantCount: number;
  merchantHealthScores: MerchantHealth[];
  modelMetrics: ModelMetrics;
  lastJobStatus: string;
  lastJobTime: string | null;
  computedAt: string;
}

export function AIAutomationPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<Set<string>>(new Set());
  const [merchantSearch, setMerchantSearch] = useState('');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isManualVerifying, setIsManualVerifying] = useState(false);
  const [jobStatus, setJobStatus] = useState<VerificationJob | null>(null);
  const [mode, setMode] = useState<AutomationMode>('login');
  const [otpNeeded, setOtpNeeded] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCookiesJson, setImportCookiesJson] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '', phone: '' });
  const [globalCredentials, setGlobalCredentials] = useState({ email: '', password: '', phone: '' });
  const [editingCreds, setEditingCreds] = useState(false);
  const [editingGlobalCreds, setEditingGlobalCreds] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [notifications, setNotifications] = useState<AutomationNotification[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const selectedMerchantRef = useRef(selectedMerchant);
  selectedMerchantRef.current = selectedMerchant;

  // ─── Load merchants ─────────────────────────────────────────────────────────
  const loadMerchants = useCallback(async () => {
    try {
      const data = await apiGet<Merchant[]>('/api/v1/merchants');
      setMerchants(Array.isArray(data) ? data : []);
    } catch {
      /* silently ignore */
    }
  }, []);

  useEffect(() => {
    loadMerchants();
    fetchJobStatus();
    fetchGlobalCredentials();
    socket.connect();

    socket.on('verification:job_started', (data) => {
      addLocalLog(`🚀 Verification job started: ${data.totalMerchants} merchants`, 'info');
      fetchJobStatus();
    });

    socket.on('verification:progress', (data) => {
      setJobStatus(prev => prev ? { ...prev, processedMerchants: data.processed } : null);
    });

    socket.on('verification:job_completed', () => {
      addLocalLog(`✅ Verification job completed!`, 'success');
      fetchJobStatus();
    });

    socket.on('automation:notification', (notif: AutomationNotification) => {
      setNotifications(prev => [notif, ...prev].slice(0, 10));
      if (notif.type === 'otp_required' && notif.merchantId === selectedMerchantRef.current) {
        setOtpNeeded(true);
      }
    });

    socket.on('health:scores_updated', (data: HealthData) => {
      setHealthData(data);
    });

    // Fetch health data on mount
    fetchHealthData();

    return () => { socket.disconnect(); };
  }, [loadMerchants]);

  const fetchJobStatus = async () => {
    try {
      const data = await apiGet<{ job: VerificationJob }>('/api/v1/automation/job-status');
      setJobStatus(data.job);
    } catch { /* ignore */ }
  };

  const toggleAutoVerification = async (mId: string, enabled: boolean) => {
    try {
      await apiPostJson(`/api/v1/automation/merchant-toggle/${mId}`, { enabled });
      await loadMerchants();
    } catch (err: any) {
      addLocalLog(`Toggle failed: ${err.message}`, 'error');
    }
  };

  const fetchHealthData = async () => {
    setLoadingHealth(true);
    try {
      const data = await apiGet<HealthData>('/api/v1/automation/health-scores');
      setHealthData(data);
    } catch { /* ignore */ }
    finally { setLoadingHealth(false); }
  };

  const startGlobalVerification = async () => {
    if (!window.confirm('Start 12h cycle for ALL enabled merchants?')) return;
    setIsVerifying(true);
    try {
      await apiPostJson('/api/v1/automation/verify-all', {});
      addLocalLog('🚀 12h cycle triggered.', 'info');
    } catch (err: any) {
      addLocalLog(`Failed to start cycle: ${err.message}`, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const startManualVerification = async () => {
    const ids = Array.from(selectedMerchantIds);
    if (ids.length === 0) {
      addLocalLog('Select at least one merchant to run manual verification.', 'warning');
      return;
    }
    if (!window.confirm(`Run manual verification on ${ids.length} selected merchant(s)?`)) return;
    setIsManualVerifying(true);
    try {
      const res = await apiPostJson<{ message: string; jobId?: string }>('/api/v1/automation/verify-selected', { merchantIds: ids });
      addLocalLog(`🚀 ${res.message}`, 'success');
    } catch (err: any) {
      addLocalLog(`Manual verify failed: ${err.message}`, 'error');
    } finally {
      setIsManualVerifying(false);
    }
  };

  // ─── Merchant selection helpers ─────────────────────────────────────────────
  const filteredMerchants = merchants.filter(m =>
    m.merchantName.toLowerCase().includes(merchantSearch.toLowerCase())
  );

  const toggleMerchantSelection = (mId: string) => {
    setSelectedMerchantIds(prev => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredMerchants.map(m => m._id);
    setSelectedMerchantIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // ─── Fetch session status when merchant selected ────────────────────────────
  const fetchSessionStatus = useCallback(async (mId: string) => {
    if (!mId) { setSessionStatus(null); return; }
    setLoadingStatus(true);
    try {
      const data = await apiGet<SessionStatus>(`/api/v1/automation/session-status/${mId}`);
      setSessionStatus(data);
    } catch {
      setSessionStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionStatus(selectedMerchant);
    if (selectedMerchant) {
      fetchCredentials(selectedMerchant);
    }
  }, [selectedMerchant, fetchSessionStatus]);

  const fetchCredentials = async (mId: string) => {
    try {
      const data = await apiGet<{ email: string; password: string; phone: string }>(`/api/v1/automation/credentials/${mId}`);
      setCredentials(data);
    } catch { /* ignore */ }
  };

  const fetchGlobalCredentials = async () => {
    try {
      const data = await apiGet<{ email: string; password: string; phone: string }>('/api/v1/automation/global-credentials');
      setGlobalCredentials(data);
    } catch { /* ignore */ }
  };

  const saveCredentials = async () => {
    if (!selectedMerchant) return;
    setSavingCreds(true);
    try {
      await apiPostJson(`/api/v1/automation/credentials/${selectedMerchant}`, credentials);
      addLocalLog('✅ Merchant credentials saved successfully', 'success');
      setEditingCreds(false);
    } catch (err: any) {
      addLocalLog(`Failed to save credentials: ${err.message}`, 'error');
    } finally {
      setSavingCreds(false);
    }
  };

  const saveGlobalCredentials = async () => {
    setSavingCreds(true);
    try {
      await apiPostJson('/api/v1/automation/global-credentials', globalCredentials);
      addLocalLog('✅ Global common credentials saved successfully', 'success');
      setEditingGlobalCreds(false);
    } catch (err: any) {
      addLocalLog(`Failed to save global credentials: ${err.message}`, 'error');
    } finally {
      setSavingCreds(false);
    }
  };

  // ─── Socket log listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMerchant) return;

    const logHandler = (log: LogEntry) => {
      setLogs((prev) => [...prev, log]);
      if (log.message.includes('Waiting for OTP') || log.message.includes('pending_otp')) {
        setOtpNeeded(true);
      }
      if (log.message.includes('Cookies saved') || log.message.includes('cookies saved')) {
        fetchSessionStatus(selectedMerchant);
      }
    };

    socket.on(`log:${selectedMerchant}`, logHandler);
    return () => { socket.off(`log:${selectedMerchant}`, logHandler); };
  }, [selectedMerchant, fetchSessionStatus]);

  // ─── Auto-scroll logs ────────────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const startAutomation = async () => {
    if (!selectedMerchant || isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setOtpNeeded(false);

    const endpoint =
      mode === 'create_account'
        ? `/api/v1/automation/create-account/${selectedMerchant}`
        : `/api/v1/automation/login/${selectedMerchant}`;

    addLocalLog(`🚀 Dispatching AI agent in "${mode === 'login' ? 'Login' : 'Create Account'}" mode…`, 'info');

    try {
      await apiPostJson(endpoint, {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLocalLog(`Failed to start: ${msg}`, 'error');
    } finally {
      setIsRunning(false);
      setOtpNeeded(false);
      await fetchSessionStatus(selectedMerchant);
    }
  };

  const submitOtp = async () => {
    if (!otpValue.trim()) return;
    try {
      await apiPostJson('/api/v1/automation/otp', {
        merchantId: selectedMerchant,
        otp: otpValue.trim(),
      });
      addLocalLog(`OTP submitted: ${otpValue}`, 'success');
      setOtpNeeded(false);
      setOtpValue('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLocalLog(`OTP submit failed: ${msg}`, 'error');
    }
  };

  const saveCookiesNow = async () => {
    if (!selectedMerchant) return;
    setSavingCookies(true);
    try {
      const data = await apiPostJson<{ message: string; cookieCount: number }>(
        `/api/v1/automation/save-session/${selectedMerchant}`,
        {},
      );
      addLocalLog(`🍪 ${data.message} (${data.cookieCount} cookies)`, 'success');
      await fetchSessionStatus(selectedMerchant);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLocalLog(`Cookie save failed: ${msg}`, 'error');
    } finally {
      setSavingCookies(false);
    }
  };

  const clearSession = async () => {
    if (!selectedMerchant) return;
    if (!window.confirm('Clear saved cookies and close browser session for this merchant?')) return;
    setClearingSession(true);
    try {
      await apiDelete(`/api/v1/automation/session/${selectedMerchant}`);
      addLocalLog('🗑️ Session cleared.', 'warning');
      await fetchSessionStatus(selectedMerchant);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLocalLog(`Clear session failed: ${msg}`, 'error');
    } finally {
      setClearingSession(false);
    }
  };

  const importCookies = async () => {
    if (!selectedMerchant || !importCookiesJson.trim()) return;
    setIsImporting(true);
    try {
      let parsedCookies;
      try {
        parsedCookies = JSON.parse(importCookiesJson);
      } catch (err) {
        throw new Error('Invalid JSON format. Please paste a valid JSON array.');
      }
      if (!Array.isArray(parsedCookies)) {
        throw new Error('Cookies must be a JSON array.');
      }
      const data = await apiPostJson<{ message: string; cookieCount: number }>(`/api/v1/automation/import-cookies/${selectedMerchant}`, {
        cookies: parsedCookies
      });
      addLocalLog(`🍪 ${data.message}`, 'success');
      setShowImportModal(false);
      setImportCookiesJson('');
      await fetchSessionStatus(selectedMerchant);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLocalLog(`Cookie import failed: ${msg}`, 'error');
      alert(`Import failed: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const addLocalLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const currentMerchant = merchants.find((m) => m._id === selectedMerchant);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="ai-automation">

      {/* ── Page Header ── */}
      <header className="ai-page-header">
        <div>
          <h1 className="ai-page-title">AI Automation Console</h1>
          <p className="ai-page-lead">
            Deploy Gemini-powered AI agents to auto-login or create accounts on merchant sites.
            Cookies are saved in real-time for future quick access.
          </p>
        </div>
        <div className="ai-header-actions">
          <button
            className={`ai-btn ${jobStatus?.status === 'running' ? 'ai-btn--secondary' : 'ai-btn--primary'}`}
            onClick={startGlobalVerification}
            disabled={isVerifying || jobStatus?.status === 'running'}
          >
            {jobStatus?.status === 'running' ? '🕒 Cycle Running' : '🔄 Start 12h Cycle'}
          </button>
          <button
            className="ai-btn ai-btn--primary"
            onClick={startManualVerification}
            disabled={isManualVerifying || selectedMerchantIds.size === 0}
          >
            {isManualVerifying ? <><span className="ai-spinner" /> Running…</> : `▶ Run on Selected (${selectedMerchantIds.size})`}
          </button>
        </div>
      </header>

      {/* ── Job Progress Panel ── */}
      {jobStatus && (
        <div className="ai-job-panel">
          <div className="ai-job-header">
            <span className="ai-job-title">
              {jobStatus.status === 'running' ? '🔵 Verification Job In Progress' : '📋 Last Verification Job'}
            </span>
            <span className="ai-badge badge--running">{jobStatus.status.toUpperCase()}</span>
          </div>
          <div className="ai-job-progress-bar">
            <div
              className="ai-job-progress-fill"
              style={{ width: `${jobStatus.totalMerchants > 0 ? (jobStatus.processedMerchants / jobStatus.totalMerchants) * 100 : 0}%` }}
            />
          </div>
          <div className="ai-job-stats">
            <span>Merchants: {jobStatus.processedMerchants} / {jobStatus.totalMerchants}</span>
            <span>Verified: {jobStatus.verifiedCount}</span>
            <span>Failed: {jobStatus.failedCount}</span>
          </div>
        </div>
      )}

      {/* ── AI Model Metrics Panel ── */}
      {healthData?.modelMetrics && (
        <div className="ai-metrics-panel">
          <div className="ai-metrics-header">
            <span className="ai-metrics-title">📊 AI Model Performance (every 12h)</span>
            <button className="ai-btn ai-btn--ghost ai-btn--sm" onClick={fetchHealthData} disabled={loadingHealth}>
              {loadingHealth ? '…' : '↺ Refresh'}
            </button>
          </div>
          <div className="ai-metrics-grid">
            <div className="ai-metric-card">
              <div className="ai-metric-value">{healthData.modelMetrics.accuracy}%</div>
              <div className="ai-metric-label">Accuracy</div>
            </div>
            <div className="ai-metric-card">
              <div className="ai-metric-value">{healthData.modelMetrics.precision}%</div>
              <div className="ai-metric-label">Precision</div>
            </div>
            <div className="ai-metric-card">
              <div className="ai-metric-value">{healthData.modelMetrics.recall}%</div>
              <div className="ai-metric-label">Recall</div>
            </div>
            <div className="ai-metric-card">
              <div className="ai-metric-value">{healthData.modelMetrics.f1Score}</div>
              <div className="ai-metric-label">F1 Score</div>
            </div>
            <div className="ai-metric-card">
              <div className="ai-metric-value">{healthData.modelMetrics.total}</div>
              <div className="ai-metric-label">Total Verifications</div>
            </div>
            <div className="ai-metric-card">
              <div className="ai-metric-value">{healthData.modelMetrics.averageAttempts}</div>
              <div className="ai-metric-label">Avg Attempts</div>
            </div>
          </div>
          <div className="ai-metrics-detail">
            <div className="ai-metrics-section">
              <strong>Status Breakdown:</strong>
              <div className="ai-metrics-chips">
                {Object.entries(healthData.modelMetrics.statusBreakdown).map(([k, v]) => (
                  <span key={k} className={`ai-chip ai-chip--${k}`}>{k}: {v}</span>
                ))}
              </div>
            </div>
            {Object.keys(healthData.modelMetrics.errorTypeBreakdown).length > 0 && (
              <div className="ai-metrics-section">
                <strong>Error Types:</strong>
                <div className="ai-metrics-chips">
                  {Object.entries(healthData.modelMetrics.errorTypeBreakdown).map(([k, v]) => (
                    <span key={k} className="ai-chip ai-chip--error">{k}: {v}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="ai-metrics-section">
              <strong>Confidence Distribution:</strong>
              <div className="ai-confidence-bars">
                {Object.entries(healthData.modelMetrics.confidenceDistribution).map(([range, count]) => (
                  <div key={range} className="ai-conf-bar">
                    <span className="ai-conf-label">{range}</span>
                    <div className="ai-conf-track">
                      <div
                        className="ai-conf-fill"
                        style={{ width: `${healthData.modelMetrics.total > 0 ? (count / healthData.modelMetrics.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="ai-conf-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            {healthData.modelMetrics.manualOverrideCount === 0 && (
              <p className="ai-metrics-note">
                ⚠️ No manual overrides yet. Metrics self-reported. Use manual override for ground truth.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Merchant Health Scores ── */}
      {healthData && healthData.merchantHealthScores.length > 0 && (
        <div className="ai-health-panel">
          <div className="ai-health-header">
            <span className="ai-health-title">❤️ Merchant Health (System: {healthData.systemHealth}%)</span>
            <span className="ai-health-time">Last: {healthData.computedAt ? new Date(healthData.computedAt).toLocaleString() : '—'}</span>
          </div>
          <div className="ai-health-grid">
            {healthData.merchantHealthScores
              .sort((a, b) => a.healthScore - b.healthScore)
              .map(h => (
                <div key={h.merchantId} className={`ai-health-card ai-health-card--${h.healthScore >= 70 ? 'good' : h.healthScore >= 40 ? 'warn' : 'bad'}`}>
                  <div className="ai-health-card-top">
                    <span className="ai-health-name">{h.merchantName}</span>
                    <span className="ai-health-score">{h.healthScore}%</span>
                  </div>
                  <div className="ai-health-bar">
                    <div className="ai-health-bar-fill" style={{ width: `${h.healthScore}%` }} />
                  </div>
                  <div className="ai-health-stats">
                    <span>🔑 Login: {h.breakdown.loginHealth}%</span>
                    <span>🍪 Cookies: {h.breakdown.cookieFreshness}%</span>
                    <span>✅ Verified: {h.verifiedCoupons}/{h.activeCoupons}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Notifications Section ── */}
      {notifications.length > 0 && (
        <div className="ai-notifications-panel">
          <div className="ai-notifications-header">
            <span className="ai-notifications-title">🔔 Recent Alerts</span>
            <button className="ai-btn ai-btn--ghost ai-btn--sm" onClick={() => setNotifications([])}>Clear All</button>
          </div>
          <div className="ai-notifications-list">
            {notifications.map(n => (
              <div key={n.id} className={`ai-notification ai-notification--${n.type}`}>
                <div className="ai-notification-content">
                  <strong>{n.merchantName}</strong>: {n.message}
                  <span className="ai-notification-time">{new Date(n.timestamp).toLocaleTimeString()}</span>
                </div>
                {n.type === 'otp_required' && (
                  <button
                    className="ai-btn ai-btn--primary ai-btn--sm"
                    onClick={() => {
                      setSelectedMerchant(n.merchantId);
                      setOtpNeeded(true);
                    }}
                  >
                    Enter OTP
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Merchants Selection Panel ── */}
      <div className="ai-merchants-panel">
        <div className="ai-merchants-panel-header">
          <span className="ai-merchants-panel-title">🎯 Merchant Selection</span>
          <div className="ai-merchants-actions">
            <input
              type="text"
              className="ai-merchants-search"
              placeholder="Search merchants…"
              value={merchantSearch}
              onChange={(e) => setMerchantSearch(e.target.value)}
            />
            <button className="ai-btn ai-btn--ghost ai-btn--sm" onClick={selectAllFiltered}>
              Toggle All
            </button>
            <button
              className="ai-btn ai-btn--primary ai-btn--sm"
              onClick={startManualVerification}
              disabled={isManualVerifying || selectedMerchantIds.size === 0}
            >
              {isManualVerifying ? '…' : `Run (${selectedMerchantIds.size})`}
            </button>
          </div>
        </div>
        <div className="ai-merchants-list">
          {filteredMerchants.length === 0 && (
            <div className="ai-merchants-empty">No merchants found.</div>
          )}
          {filteredMerchants.map((m) => (
            <div
              key={m._id}
              className={`ai-merchant-row ${selectedMerchantIds.has(m._id) ? 'ai-merchant-row--selected' : ''}`}
            >
              <div className="ai-merchant-row-left">
                <input
                  type="checkbox"
                  className="ai-merchant-checkbox"
                  checked={selectedMerchantIds.has(m._id)}
                  onChange={() => toggleMerchantSelection(m._id)}
                />
                <span className="ai-merchant-name">{m.merchantName}</span>
                <span className={`ai-merchant-status ai-merchant-status--${m.status}`}>{m.status}</span>
              </div>
              <div className="ai-merchant-row-right">
                <span className="ai-merchant-toggle-label">12h auto</span>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={m.autoVerificationEnabled ?? true}
                    onChange={(e) => toggleAutoVerification(m._id, e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Control Panel ── */}
      <div className="ai-control-panel">

        {/* Left: Merchant & Config */}
        <div className="ai-control-left">
          <div className="ai-control-group">
            <label className="ai-label" htmlFor="merchant-select">Target Merchant</label>
            <div className="ai-select-wrapper">
              <select
                id="merchant-select"
                className="ai-select"
                value={selectedMerchant}
                onChange={(e) => {
                  setSelectedMerchant(e.target.value);
                  setLogs([]);
                  setOtpNeeded(false);
                }}
                disabled={isRunning}
              >
                <option value="">— Select a merchant —</option>
                {merchants.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.merchantName} {m.status === 'inactive' ? '(inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Center: Credentials (Global or Merchant) */}
        <div className="ai-control-center">
          <div className="ai-credentials-panel">
            <div className="ai-credentials-header">
              <span className="ai-credentials-title">
                {selectedMerchant ? 'Merchant Credentials' : 'Global Common Credentials'}
              </span>
              <button
                className="ai-btn ai-btn--ghost ai-btn--sm"
                onClick={() => selectedMerchant ? setEditingCreds(!editingCreds) : setEditingGlobalCreds(!editingGlobalCreds)}
              >
                {(selectedMerchant ? editingCreds : editingGlobalCreds) ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {(selectedMerchant ? editingCreds : editingGlobalCreds) ? (
              <div className="ai-credentials-form">
                <div className="ai-cred-grid">
                  <div className="ai-cred-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={selectedMerchant ? credentials.email : globalCredentials.email}
                      onChange={(e) => selectedMerchant
                        ? setCredentials(c => ({ ...c, email: e.target.value }))
                        : setGlobalCredentials(c => ({ ...c, email: e.target.value }))
                      }
                      className="ai-input ai-input--compact"
                    />
                  </div>
                  <div className="ai-cred-field">
                    <label>Password</label>
                    <input
                      type="text"
                      value={selectedMerchant ? credentials.password : globalCredentials.password}
                      onChange={(e) => selectedMerchant
                        ? setCredentials(c => ({ ...c, password: e.target.value }))
                        : setGlobalCredentials(c => ({ ...c, password: e.target.value }))
                      }
                      className="ai-input ai-input--compact"
                    />
                  </div>
                  <div className="ai-cred-field">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={selectedMerchant ? credentials.phone : globalCredentials.phone}
                      onChange={(e) => selectedMerchant
                        ? setCredentials(c => ({ ...c, phone: e.target.value }))
                        : setGlobalCredentials(c => ({ ...c, phone: e.target.value }))
                      }
                      className="ai-input ai-input--compact"
                    />
                  </div>
                </div>
                <button
                  className="ai-btn ai-btn--primary ai-btn--sm"
                  onClick={selectedMerchant ? saveCredentials : saveGlobalCredentials}
                  disabled={savingCreds}
                >
                  {savingCreds ? 'Saving…' : 'Save Credentials'}
                </button>
              </div>
            ) : (
              <div className="ai-credentials-display">
                <div className="ai-cred-row">
                  <span className="ai-cred-label">Email:</span>
                  <code className="ai-cred-value">{(selectedMerchant ? credentials.email : globalCredentials.email) || '—'}</code>
                </div>
                <div className="ai-cred-row">
                  <span className="ai-cred-label">Password:</span>
                  <code className="ai-cred-value">{(selectedMerchant ? credentials.password : globalCredentials.password) || '—'}</code>
                </div>
                <div className="ai-cred-row">
                  <span className="ai-cred-label">Phone:</span>
                  <code className="ai-cred-value">{(selectedMerchant ? credentials.phone : globalCredentials.phone) || '—'}</code>
                </div>
              </div>
            )}
            {!selectedMerchant && <p className="ai-cred-hint">These apply to all merchants by default.</p>}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="ai-control-right">
          <div className="ai-control-group">
            <label className="ai-label">Automation Mode</label>
            <div className="ai-mode-toggle">
              <button
                type="button"
                id="mode-login"
                className={`ai-mode-btn ${mode === 'login' ? 'ai-mode-btn--active' : ''}`}
                onClick={() => setMode('login')}
                disabled={isRunning}
              >
                🔑 Auto Login
              </button>
              <button
                type="button"
                id="mode-create"
                className={`ai-mode-btn ${mode === 'create_account' ? 'ai-mode-btn--active' : ''}`}
                onClick={() => setMode('create_account')}
                disabled={isRunning}
              >
                ✨ Create Account
              </button>
            </div>
          </div>
          <button
            id="start-automation-btn"
            className="ai-btn ai-btn--primary ai-btn--launch"
            onClick={startAutomation}
            disabled={!selectedMerchant || isRunning}
          >
            {isRunning ? (
              <><span className="ai-spinner" /> Agent Active…</>
            ) : (
              mode === 'login' ? '▶ Start Login' : '▶ Create Account'
            )}
          </button>
        </div>
      </div>

      {/* ── Session Status Card ── */}
      {selectedMerchant && (
        <div className="ai-session-card">
          <div className="ai-session-card-header">
            <span className="ai-session-card-title">
              {currentMerchant?.merchantName ?? 'Merchant'} — Session Status
            </span>
            <button
              className="ai-btn ai-btn--ghost ai-btn--sm"
              onClick={() => fetchSessionStatus(selectedMerchant)}
              disabled={loadingStatus}
            >
              {loadingStatus ? '…' : '↺ Refresh'}
            </button>
          </div>

          {sessionStatus && (
            <div className="ai-session-grid">
              <div className="ai-session-stat">
                <span className="ai-session-stat-label">Login Status</span>
                <StatusBadge status={sessionStatus.lastLoginAttempt.status} />
              </div>
              <div className="ai-session-stat">
                <span className="ai-session-stat-label">Saved Cookies</span>
                <span className={`ai-session-stat-value ${sessionStatus.hasSavedCookies ? 'value--ok' : 'value--empty'}`}>
                  {sessionStatus.hasSavedCookies
                    ? `🍪 ${sessionStatus.cookieCount} cookies saved`
                    : '⚪ No cookies saved'}
                </span>
              </div>
              <div className="ai-session-stat">
                <span className="ai-session-stat-label">Browser Session</span>
                <span className={`ai-session-stat-value ${sessionStatus.hasActiveBrowserSession ? 'value--ok' : 'value--empty'}`}>
                  {sessionStatus.hasActiveBrowserSession ? '🟢 Active' : '⚫ No active session'}
                </span>
              </div>
              <div className="ai-session-stat">
                <span className="ai-session-stat-label">Mapped UI Actions</span>
                <span className="ai-session-stat-value">
                  {sessionStatus.actionMapCount > 0
                    ? `🗺️ ${sessionStatus.actionMapCount} mappings cached`
                    : '⚪ None yet'}
                </span>
              </div>
              {sessionStatus.lastLoginAttempt.lastAttempted && (
                <div className="ai-session-stat ai-session-stat--wide">
                  <span className="ai-session-stat-label">Last Attempt</span>
                  <span className="ai-session-stat-value">
                    {formatDate(sessionStatus.lastLoginAttempt.lastAttempted)}
                    {sessionStatus.lastLoginAttempt.message && (
                      <em className="ai-session-message"> — {sessionStatus.lastLoginAttempt.message}</em>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Cookie & Session Actions */}
          <div className="ai-session-actions">
            <button
              id="save-cookies-btn"
              className="ai-btn ai-btn--cookie"
              onClick={saveCookiesNow}
              disabled={savingCookies || !sessionStatus?.hasActiveBrowserSession}
              title={!sessionStatus?.hasActiveBrowserSession ? 'Start an automation first to create a browser session' : 'Snapshot current cookies to DB'}
            >
              {savingCookies ? '⏳ Saving…' : '🍪 Save Cookies Now'}
            </button>
            <button
              id="clear-session-btn"
              className="ai-btn ai-btn--danger-ghost"
              onClick={clearSession}
              disabled={clearingSession}
            >
              {clearingSession ? '⏳ Clearing…' : '🗑️ Clear Session & Cookies'}
            </button>
            <button
              id="import-cookies-btn"
              className="ai-btn ai-btn--ghost"
              onClick={() => setShowImportModal(true)}
              title="Import JSON array of cookies manually"
            >
              📥 Import Cookies
            </button>
          </div>
        </div>
      )}

      {/* ── Live Log Console ── */}
      <div className="log-console">
        <div className="log-header">
          <div className="log-header-title">
            Live Session Output
            {currentMerchant ? ` — ${currentMerchant.merchantName}` : ''}
          </div>
          <div className="log-status-indicator">
            <div className={`status-dot ${isRunning ? 'status-dot--active' : ''}`} />
            {isRunning ? 'Agent Running' : 'Standby'}
          </div>
        </div>

        <div className="log-entries">
          {logs.length === 0 && (
            <div className="log-entry log-entry--info">
              <span className="log-message">
                {selectedMerchant
                  ? 'Select mode and click Start Automation to begin…'
                  : 'Select a merchant to get started.'}
              </span>
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`log-entry log-entry--${log.type}`}>
              <span className="log-time">
                [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* ── OTP Intervention Overlay ── */}
        {otpNeeded && (
          <div className="otp-overlay" role="dialog" aria-modal="true" aria-label="OTP Required">
            <div className="otp-overlay-icon">🔒</div>
            <h3>Human Intervention Required</h3>
            <p>
              The AI agent hit a 2FA / OTP challenge on{' '}
              <strong>{currentMerchant?.merchantName}</strong>.
              Enter the code sent to your device to continue.
            </p>
            <div className="otp-input-group">
              <input
                id="otp-input"
                type="text"
                className="ai-otp-input"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitOtp(); }}
                placeholder="e.g. 123456"
                autoFocus
                maxLength={10}
              />
              <button
                id="submit-otp-btn"
                className="ai-btn ai-btn--primary"
                onClick={submitOtp}
                disabled={!otpValue.trim()}
              >
                Push to Agent
              </button>
            </div>
            <button
              className="otp-dismiss"
              onClick={() => setOtpNeeded(false)}
            >
              Dismiss (skip OTP)
            </button>
          </div>
        )}
      </div>

      {/* ── Mode Info ── */}
      <div className="ai-mode-info">
        {mode === 'login' ? (
          <div className="ai-info-card ai-info-card--blue">
            <strong>🔑 Auto Login Mode</strong>
            <p>
              The AI agent will navigate to the merchant site and log in using the configured merchant credentials.
              If no specific credentials are set, it defaults to the system standard.
              It learns and caches selector mappings so future runs on the same site are faster.
              Cookies are saved automatically upon success.
            </p>
          </div>
        ) : (
          <div className="ai-info-card ai-info-card--cyan">
            <strong>✨ Create Account Mode</strong>
            <p>
              The AI agent will find the sign-up page and create a new account using the configured merchant credentials.
              It handles email, phone, and password fields automatically.
              OTP/2FA challenges will be forwarded to you for manual input.
            </p>
          </div>
        )}
      </div>

      {/* ── Cookie Import Modal ── */}
      {showImportModal && (
        <div className="otp-overlay" role="dialog" aria-modal="true" aria-label="Import Cookies">
          <div className="otp-overlay-icon">🍪</div>
          <h3>Import Manual Cookies</h3>
          <p>Paste a JSON array of cookies (e.g. from a browser extension like EditThisCookie).</p>
          <div className="otp-input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <textarea
              className="ai-input"
              rows={8}
              value={importCookiesJson}
              onChange={(e) => setImportCookiesJson(e.target.value)}
              placeholder='[{"name": "session", "value": "xyz"...}]'
              style={{ width: '100%', marginBottom: '1rem', fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="ai-btn ai-btn--ghost"
                onClick={() => {
                  setShowImportModal(false);
                  setImportCookiesJson('');
                }}
              >
                Cancel
              </button>
              <button
                className="ai-btn ai-btn--primary"
                onClick={importCookies}
                disabled={isImporting || !importCookiesJson.trim()}
              >
                {isImporting ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
