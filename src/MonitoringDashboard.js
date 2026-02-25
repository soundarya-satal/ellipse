import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import './Monitoring.css';

const API_BASE = 'https://func-invoice-v2.azurewebsites.net/api';

const fmt = {
    ms: (ms) => {
        if (ms == null) return '—';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}min`;
    },
    date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    time: (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
    pct:  (n) => `${n}%`,
    amount: (a) => a != null ? `₹${Number(a).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
};

// ── Mini bar chart ────────────────────────────────────────────────────────────
const BarChart = ({ data, valueKey, labelKey, color = '#4f6ef7', height = 120 }) => {
    if (!data || data.length === 0) return <div className="chart-empty">No data</div>;
    const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
    return (
        <div className="bar-chart" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="bar-col">
                    <div
                        className="bar-fill"
                        style={{
                            height: `${((d[valueKey] || 0) / max) * 100}%`,
                            background: color
                        }}
                        title={`${d[labelKey]}: ${d[valueKey]}`}
                    />
                    <span className="bar-label">{d[labelKey]}</span>
                </div>
            ))}
        </div>
    );
};

// ── SLA gauge ─────────────────────────────────────────────────────────────────
const SLAGauge = ({ rate }) => {
    const color = rate >= 90 ? '#22c97a' : rate >= 70 ? '#f5c842' : '#ff4d6a';
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (rate / 100) * circumference;

    return (
        <div className="sla-gauge">
            <svg viewBox="0 0 120 120" width="120" height="120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#1c2030" strokeWidth="12" />
                <circle
                    cx="60" cy="60" r="54" fill="none"
                    stroke={color} strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                <text x="60" y="58" textAnchor="middle" fill={color} fontSize="20" fontWeight="700" fontFamily="'Space Mono', monospace">
                    {rate}%
                </text>
                <text x="60" y="74" textAnchor="middle" fill="#555e80" fontSize="9" fontFamily="'Space Mono', monospace">
                    COMPLIANT
                </text>
            </svg>
        </div>
    );
};

// ── Metric card ───────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, accent, icon }) => (
    <div className={`metric-card ${accent ? `metric-${accent}` : ''}`}>
        {icon && <span className="metric-icon">{icon}</span>}
        <div className="metric-body">
            <span className="metric-value">{value}</span>
            <span className="metric-label">{label}</span>
            {sub && <span className="metric-sub">{sub}</span>}
        </div>
    </div>
);

// ── Main Monitoring Dashboard ─────────────────────────────────────────────────
export default function MonitoringDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/monitoring/summary`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setLastRefresh(new Date());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const iv = setInterval(load, 60000); // refresh every 60s
        return () => clearInterval(iv);
    }, [load]);

    if (loading && !data) return (
        <div className="mon-loading">
            <div className="spinner" />
            <span>Loading monitoring data...</span>
        </div>
    );

    if (error) return (
        <div className="mon-error">
            <span>⚠ Failed to load: {error}</span>
            <button className="btn-refresh-mon" onClick={load}>Retry</button>
        </div>
    );

    if (!data) return null;

    const { overview, sla, performance, categoryBreakdown, hourlyVolume, recentActivity, recentErrors } = data;

    return (
        <div className="monitoring">
            {/* Header */}
            <div className="mon-header">
                <div>
                    <span className="section-tag">MODULE 03</span>
                    <h2 style={{ marginTop: 8 }}>Processing Monitor & SLA Tracker</h2>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        Azure Application Insights · Auto-refresh 60s
                        {lastRefresh && ` · Last updated ${fmt.time(lastRefresh)}`}
                    </span>
                </div>
                <button className="btn-refresh-mon" onClick={load} disabled={loading}>
                    {loading ? '↻ Refreshing...' : '↻ Refresh Now'}
                </button>
            </div>

            {/* SLA Banner if breaches exist */}
            {sla.currentlyBreaching?.length > 0 && (
                <div className="sla-alert">
                    <span className="sla-alert-icon">⚠</span>
                    <span>
                        <strong>{sla.currentlyBreaching.length} invoice(s)</strong> currently breaching SLA —
                        stuck in Processing for over 2 minutes
                    </span>
                    <div className="sla-alert-ids">
                        {sla.currentlyBreaching.map(b => (
                            <span key={b.id} className="breach-id">
                                {b.id.slice(0, 18)}… ({fmt.ms(b.elapsedMs)})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Overview metrics */}
            <div className="mon-row">
                <MetricCard label="Total Invoices"  value={overview.total}      icon="📄" />
                <MetricCard label="Completed"        value={overview.completed}  icon="✓"  accent="green" />
                <MetricCard label="Failed"           value={overview.failed}     icon="✕"  accent="red" />
                <MetricCard label="In Queue"         value={overview.pending}    icon="⏳" accent="yellow" />
                <MetricCard label="SLA Breached"     value={overview.slaBreached} icon="⚠" accent={overview.slaBreached > 0 ? 'red' : 'green'} />
                <MetricCard label="Total Value"      value={fmt.amount(overview.totalValue)} icon="₹" accent="blue" />
            </div>

            {/* SLA + Performance row */}
            <div className="mon-grid-2">
                {/* SLA Panel */}
                <div className="mon-panel">
                    <div className="panel-title">SLA Compliance · 2 min threshold</div>
                    <div className="sla-content">
                        <SLAGauge rate={sla.complianceRate} />
                        <div className="sla-stats">
                            <div className="sla-stat">
                                <span className="sla-stat-val green">{sla.compliant}</span>
                                <span className="sla-stat-lbl">Within SLA</span>
                            </div>
                            <div className="sla-stat">
                                <span className="sla-stat-val red">{sla.nonCompliant}</span>
                                <span className="sla-stat-lbl">Breached</span>
                            </div>
                            <div className="sla-stat">
                                <span className="sla-stat-val yellow">{sla.currentlyBreaching?.length || 0}</span>
                                <span className="sla-stat-lbl">Currently Breaching</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Panel */}
                <div className="mon-panel">
                    <div className="panel-title">Processing Performance</div>
                    <div className="perf-grid">
                        <div className="perf-stat">
                            <span className="perf-val">{fmt.ms(performance.avgDurationMs)}</span>
                            <span className="perf-lbl">Avg Duration</span>
                        </div>
                        <div className="perf-stat">
                            <span className="perf-val">{fmt.ms(performance.minDurationMs)}</span>
                            <span className="perf-lbl">Fastest</span>
                        </div>
                        <div className="perf-stat">
                            <span className="perf-val red">{fmt.ms(performance.maxDurationMs)}</span>
                            <span className="perf-lbl">Slowest</span>
                        </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <div className="panel-sub">Processing Time Distribution</div>
                        <BarChart
                            data={performance.processingTimeBuckets}
                            valueKey="count"
                            labelKey="range"
                            color="#4f6ef7"
                            height={100}
                        />
                    </div>
                </div>
            </div>

            {/* Hourly Volume + Category row */}
            <div className="mon-grid-2">
                <div className="mon-panel">
                    <div className="panel-title">Hourly Volume — Last 24 Hours</div>
                    {hourlyVolume.length === 0 ? (
                        <div className="chart-empty">No activity in last 24h</div>
                    ) : (
                        <BarChart
                            data={hourlyVolume}
                            valueKey="uploaded"
                            labelKey="hour"
                            color="#4f6ef7"
                            height={130}
                        />
                    )}
                </div>

                <div className="mon-panel">
                    <div className="panel-title">Category Breakdown</div>
                    {categoryBreakdown.length === 0 ? (
                        <div className="chart-empty">No categories yet</div>
                    ) : (
                        <div className="category-list">
                            {categoryBreakdown.map((cat, i) => {
                                const total = categoryBreakdown.reduce((s, c) => s + c.count, 0);
                                const pct = Math.round((cat.count / total) * 100);
                                return (
                                    <div key={i} className="cat-row">
                                        <span className="cat-name">{cat.name}</span>
                                        <div className="cat-bar-wrap">
                                            <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="cat-pct">{pct}%</span>
                                        <span className="cat-count">{cat.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent SLA Breaches */}
            {sla.recentBreaches?.length > 0 && (
                <div className="mon-panel">
                    <div className="panel-title">Recent SLA Breaches</div>
                    <table className="mon-table">
                        <thead>
                            <tr>
                                <th>Invoice ID</th>
                                <th>Vendor</th>
                                <th>Duration</th>
                                <th>Status</th>
                                <th>Uploaded</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sla.recentBreaches.map(b => (
                                <tr key={b.id}>
                                    <td className="mono-sm">{b.id.slice(0, 20)}…</td>
                                    <td>{b.vendorName}</td>
                                    <td className="red">{fmt.ms(b.processingDurationMs)}</td>
                                    <td>{b.processingStatus}</td>
                                    <td className="mono-sm">{fmt.date(b.uploadedDateTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Recent Errors */}
            {recentErrors?.length > 0 && (
                <div className="mon-panel">
                    <div className="panel-title">Recent Errors</div>
                    <table className="mon-table">
                        <thead>
                            <tr>
                                <th>Invoice ID</th>
                                <th>Vendor</th>
                                <th>Error</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentErrors.map(e => (
                                <tr key={e.id}>
                                    <td className="mono-sm">{e.id.slice(0, 20)}…</td>
                                    <td>{e.vendorName}</td>
                                    <td className="red error-msg">{e.errorMessage}</td>
                                    <td className="mono-sm">{fmt.date(e.uploadedDateTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Recent Activity */}
            <div className="mon-panel">
                <div className="panel-title">Recent Activity</div>
                <table className="mon-table">
                    <thead>
                        <tr>
                            <th>Invoice ID</th>
                            <th>Vendor</th>
                            <th>Status</th>
                            <th>Duration</th>
                            <th>SLA</th>
                            <th>Amount</th>
                            <th>Uploaded</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentActivity.map(inv => (
                            <tr key={inv.id}>
                                <td className="mono-sm">{inv.id.slice(0, 18)}…</td>
                                <td>{inv.vendorName}</td>
                                <td>
                                    <span className={`badge badge-${inv.processingStatus?.toLowerCase()}`}>
                                        {inv.processingStatus}
                                    </span>
                                </td>
                                <td className="mono-sm">{fmt.ms(inv.processingDurationMs)}</td>
                                <td>
                                    {inv.processingStatus === 'Completed'
                                        ? <span className={inv.slaBreached ? 'red' : 'green'}>
                                            {inv.slaBreached ? '⚠ Breached' : '✓ OK'}
                                          </span>
                                        : <span style={{ color: 'var(--text3)' }}>—</span>
                                    }
                                </td>
                                <td className="mono-sm">{fmt.amount(inv.totalAmount)}</td>
                                <td className="mono-sm">{fmt.date(inv.uploadedDateTime)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}