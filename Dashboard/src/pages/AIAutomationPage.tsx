import { useEffect, useState, useRef } from 'react';
import { socket } from '../config/socket';
import { apiGet, apiPostJson } from '../lib/api';
import './AIAutomationPage.css';

interface Merchant {
  _id: string;
  merchantName: string;
  website: string;
  lastLoginAttempt?: {
    status: string;
    message?: string;
  };
}

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export function AIAutomationPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [otpNeeded, setOtpNeeded] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<Merchant[]>('/api/v1/merchants').then(setMerchants);
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedMerchant) {
      const logHandler = (log: LogEntry) => {
        setLogs((prev) => [...prev, log]);
        if (log.message.includes('Waiting for OTP')) {
          setOtpNeeded(true);
        }
      };

      socket.on(`log:${selectedMerchant}`, logHandler);
      return () => {
        socket.off(`log:${selectedMerchant}`, logHandler);
      };
    }
  }, [selectedMerchant]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startAutomation = async () => {
    if (!selectedMerchant) return;
    setIsRunning(true);
    setLogs([]);
    setOtpNeeded(false);
    try {
      await apiPostJson(`/api/v1/automation/login/${selectedMerchant}`, {});
    } catch (err: any) {
      setLogs((prev) => [...prev, { 
        message: `Failed to start: ${err.message}`, 
        type: 'error', 
        timestamp: new Date() 
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const submitOtp = async () => {
    try {
      await apiPostJson('/api/v1/automation/otp', { 
        merchantId: selectedMerchant, 
        otp: otpValue 
      });
      setOtpNeeded(false);
      setOtpValue('');
    } catch (err: any) {
      alert('Failed to submit OTP: ' + err.message);
    }
  };

  const currentMerchantName = merchants.find(m => m._id === selectedMerchant)?.merchantName || 'System';

  return (
    <div className="ai-automation">
      <header className="automation-header-card">
        <div className="header-text">
          <h1 className="dash-home-title">AI Automation Console</h1>
          <p className="dash-home-lead">Deploy AI agents to handle browser-based merchant interactions.</p>
        </div>
        
        <div className="automation-controls">
          <label className="dash-field automation-merchant-selector">
            Target Merchant
            <select 
              className="dash-input"
              value={selectedMerchant}
              onChange={(e) => setSelectedMerchant(e.target.value)}
              disabled={isRunning}
            >
              <option value="">Select a merchant...</option>
              {merchants.map(m => (
                <option key={m._id} value={m._id}>{m.merchantName}</option>
              ))}
            </select>
          </label>
          
          <button 
            className="dash-button dash-button--primary"
            onClick={startAutomation}
            disabled={!selectedMerchant || isRunning}
            style={{ marginTop: '20px' }}
          >
            {isRunning ? 'Agent Active' : 'Start Automation'}
          </button>
        </div>
      </header>

      <div className="log-console">
        <div className="log-header">
          <div className="log-header-title">Live Session Output - {currentMerchantName}</div>
          <div className="log-status-indicator">
            <div className={`status-dot ${isRunning ? 'status-dot--active' : ''}`}></div>
            {isRunning ? 'Agent Running' : 'Standby'}
          </div>
        </div>

        <div className="log-entries">
          {logs.length === 0 && (
            <div className="log-entry log-entry--info">
              <span className="log-message">Waiting for session initialization...</span>
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`log-entry log-entry--${log.type}`}>
              <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {otpNeeded && (
          <div className="otp-overlay">
            <h3>2FA Intervention Required</h3>
            <p>The AI agent encountered a security challenge on {currentMerchantName}. Please provide the OTP sent to your device.</p>
            <div className="otp-input-group">
              <input 
                type="text" 
                className="dash-input dash-input--dark"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                placeholder="Enter 6-digit code"
                autoFocus
              />
              <button className="dash-button dash-button--primary" onClick={submitOtp}>Push to Agent</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
