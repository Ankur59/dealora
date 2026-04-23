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
  lastLoginAttempt?: {
    status: 'idle' | 'running' | 'pending_otp' | 'success' | 'failed';
    message?: string;
    lastAttempted?: string;
  };
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

export function AIAutomationPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<AutomationMode>('login');
  const [otpNeeded, setOtpNeeded] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

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
    socket.connect();
    return () => { socket.disconnect(); };
  }, [loadMerchants]);

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
  }, [selectedMerchant, fetchSessionStatus]);

  // ─── Socket log listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMerchant) return;

    const logHandler = (log: LogEntry) => {
      setLogs((prev) => [...prev, log]);
      if (log.message.includes('Waiting for OTP') || log.message.includes('pending_otp')) {
        setOtpNeeded(true);
      }
      if (log.message.includes('Cookies saved') || log.message.includes('cookies saved')) {
        // Refresh session status after cookie save
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
        <div className="ai-creds-badge">
          <span className="ai-creds-label">Standard Credentials</span>
          <code>Nobentadeal@gmail.com</code>
          <code>Mumbai@123</code>
          <code>+91 7425817074</code>
        </div>
      </header>

      {/* ── Control Panel ── */}
      <div className="ai-control-panel">

        {/* Merchant Selector */}
        <div className="ai-control-group">
          <label className="ai-label" htmlFor="merchant-select">Target Merchant</label>
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

        {/* Mode Toggle */}
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

        {/* Launch Button */}
        <div className="ai-control-group ai-control-group--launch">
          <button
            id="start-automation-btn"
            className="ai-btn ai-btn--primary"
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
              The AI agent will navigate to the merchant site and log in using the standard credentials
              (<code>Nobentadeal@gmail.com</code> / <code>Mumbai@123</code>).
              It learns and caches selector mappings so future runs on the same site are faster.
              Cookies are saved automatically upon success.
            </p>
          </div>
        ) : (
          <div className="ai-info-card ai-info-card--purple">
            <strong>✨ Create Account Mode</strong>
            <p>
              The AI agent will find the sign-up page and create a new account using the standard credentials.
              It handles email, phone, and password fields automatically.
              OTP/2FA challenges will be forwarded to you for manual input.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
