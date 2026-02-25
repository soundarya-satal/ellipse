import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import MonitoringDashboard from './MonitoringDashboard';

const API_BASE = 'https://func-invoice-v2.azurewebsites.net/api';

const api = {
    getInvoices: (status) =>
        fetch(`${API_BASE}/invoices${status ? `?status=${status}` : ''}`).then(r => r.json()),
    getInvoice: (id) =>
        fetch(`${API_BASE}/invoices/${id}`).then(r => r.json()),
    getLogs: (id) =>
        fetch(`${API_BASE}/invoices/${id}/logs`).then(r => r.json()),
    uploadInvoice: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return fetch(`${API_BASE}/invoices`, { method: 'POST', body: fd }).then(r => r.json());
    },
    processInvoice: (id) =>
        fetch(`${API_BASE}/invoices/${id}/process`, { method: 'POST' }).then(r => r.json()),
};

const StatusBadge = ({ status }) => {
    const map = {
        Completed:  { cls: 'badge-completed',  label: 'COMPLETED'  },
        Processing: { cls: 'badge-processing', label: 'PROCESSING' },
        Pending:    { cls: 'badge-pending',    label: 'PENDING'    },
        Failed:     { cls: 'badge-failed',     label: 'FAILED'     },
        Queued:     { cls: 'badge-queued',     label: 'QUEUED'     },
    };
    const { cls, label } = map[status] || { cls: 'badge-pending', label: status?.toUpperCase() };
    return <span className={`badge ${cls}`}>{label}</span>;
};

const fmt = {
    date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    time: (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
    amount: (a, c) => a != null ? `${c || '₹'} ${Number(a).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
    ms: (ms) => ms != null ? (ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}min`) : '—',
};

const UploadZone = ({ onUploadSuccess }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFile = async (file) => {
        if (!file) return;
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (!allowed.includes(file.type)) {
            setResult({ error: true, message: 'Only PDF, JPG, PNG, TIFF files allowed.' });
            return;
        }
        setUploading(true);
        setResult(null);
        try {
            const res = await api.uploadInvoice(file);
            setResult({ error: false, message: `Uploaded! ID: ${res.invoiceId}`, id: res.invoiceId });
            onUploadSuccess?.();
        } catch (e) {
            setResult({ error: true, message: 'Upload failed. Check your connection.' });
        } finally {
            setUploading(false);
        }
    };

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    }, []);

    return (
        <div className="upload-section">
            <div className="section-header">
                <span className="section-tag">MODULE 01</span>
                <h2>Upload Invoice</h2>
            </div>
            <div
                className={`drop-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('file-input').click()}
            >
                <input id="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff"
                    style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
                <div className="drop-zone-inner">
                    {uploading ? (
                        <><div className="spinner" /><p className="drop-label">Uploading to Azure Blob Storage...</p></>
                    ) : (
                        <>
                            <div className="drop-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p className="drop-label">Drop invoice here or <span className="drop-cta">browse files</span></p>
                            <p className="drop-sub">PDF · JPG · PNG · TIFF — max 20MB</p>
                        </>
                    )}
                </div>
            </div>
            {result && (
                <div className={`upload-result ${result.error ? 'result-error' : 'result-success'}`}>
                    <span>{result.error ? '✕' : '✓'}</span>
                    <span>{result.message}</span>
                    {!result.error && result.id && (
                        <button className="btn-xs" onClick={() => api.processInvoice(result.id)}>Process Now</button>
                    )}
                </div>
            )}
        </div>
    );
};

const StatsBar = ({ invoices }) => {
    const total     = invoices.length;
    const completed = invoices.filter(i => i.processingStatus === 'Completed').length;
    const failed    = invoices.filter(i => i.processingStatus === 'Failed').length;
    const pending   = invoices.filter(i => ['Pending', 'Processing', 'Queued'].includes(i.processingStatus)).length;
    const dupes     = invoices.filter(i => i.isDuplicate).length;
    const totalAmt  = invoices.filter(i => i.totalAmount).reduce((s, i) => s + (i.totalAmount || 0), 0);

    const stats = [
        { label: 'Total Invoices', value: total },
        { label: 'Completed',      value: completed, accent: 'green'  },
        { label: 'Failed',         value: failed,    accent: 'red'    },
        { label: 'In Queue',       value: pending,   accent: 'yellow' },
        { label: 'Duplicates',     value: dupes,     accent: 'orange' },
        { label: 'Total Value',    value: fmt.amount(totalAmt, '₹'), accent: 'blue' },
    ];

    return (
        <div className="stats-bar">
            {stats.map((s, i) => (
                <div key={i} className={`stat-card ${s.accent ? `accent-${s.accent}` : ''}`}>
                    <span className="stat-value">{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                </div>
            ))}
        </div>
    );
};

const InvoiceTable = ({ invoices, onSelect, loading }) => {
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const statuses = ['All', 'Completed', 'Processing', 'Pending', 'Failed'];

    const filtered = invoices.filter(inv => {
        const matchStatus = filter === 'All' || inv.processingStatus === filter;
        const matchSearch = !search ||
            (inv.vendorName || '').toLowerCase().includes(search.toLowerCase()) ||
            (inv.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            inv.id.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    return (
        <div className="table-section">
            <div className="section-header">
                <span className="section-tag">MODULE 02</span>
                <h2>Invoice Registry</h2>
                <span className="record-count">{filtered.length} records</span>
            </div>
            <div className="table-controls">
                <div className="filter-tabs">
                    {statuses.map(s => (
                        <button key={s} className={`filter-tab ${filter === s ? 'active' : ''}`}
                            onClick={() => setFilter(s)}>{s}</button>
                    ))}
                </div>
                <input className="search-input" placeholder="Search vendor, invoice no..."
                    value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? (
                <div className="table-loading"><div className="spinner" /><span>Fetching from Cosmos DB...</span></div>
            ) : (
                <div className="table-wrapper">
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Invoice ID</th><th>Vendor</th><th>Invoice No.</th>
                                <th>Date</th><th>Amount</th><th>Category</th>
                                <th>Status</th><th>Duration</th><th>SLA</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="10" className="empty-row">No invoices found</td></tr>
                            ) : filtered.map(inv => (
                                <tr key={inv.id} className={`table-row ${inv.isDuplicate ? 'row-dupe' : ''}`}>
                                    <td className="id-cell" title={inv.id}>{inv.id.slice(0, 16)}…</td>
                                    <td>{inv.vendorName || <span className="null-val">—</span>}</td>
                                    <td>{inv.invoiceNumber || <span className="null-val">—</span>}</td>
                                    <td>{fmt.date(inv.invoiceDate || inv.uploadedDateTime)}</td>
                                    <td className="amount-cell">{fmt.amount(inv.totalAmount, inv.currency)}</td>
                                    <td>{inv.category ? <span className="cat-tag">{inv.category}</span> : <span className="null-val">—</span>}</td>
                                    <td><StatusBadge status={inv.processingStatus} /></td>
                                    <td className="dur-cell">{fmt.ms(inv.processingDurationMs)}</td>
                                    <td>
                                        {inv.processingStatus === 'Completed'
                                            ? <span style={{ color: inv.slaBreached ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                                {inv.slaBreached ? '⚠ Breach' : '✓ OK'}
                                              </span>
                                            : <span className="null-val">—</span>
                                        }
                                    </td>
                                    <td><button className="btn-detail" onClick={() => onSelect(inv)}>View →</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const InvoiceModal = ({ invoice, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!invoice) return;
        api.getLogs(invoice.id).then(r => setLogs(r.logs || []));
    }, [invoice]);

    if (!invoice) return null;

    const handleProcess = async () => {
        setProcessing(true);
        await api.processInvoice(invoice.id);
        setProcessing(false);
        onClose();
    };

    const ed = invoice.extractedData || {};

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <span className="section-tag">INVOICE DETAIL</span>
                        <h2>{invoice.id}</h2>
                    </div>
                    <div className="modal-actions">
                        {['Pending', 'Failed'].includes(invoice.processingStatus) && (
                            <button className="btn-process" onClick={handleProcess} disabled={processing}>
                                {processing ? 'Processing...' : '⚡ Process'}
                            </button>
                        )}
                        {invoice.blobUrl && (
                            <a className="btn-download" href={invoice.blobUrl} target="_blank" rel="noreferrer">↓ Download</a>
                        )}
                        <button className="btn-close" onClick={onClose}>✕</button>
                    </div>
                </div>
                <div className="modal-body">
                    <div className="detail-grid">
                        <div className="detail-col">
                            <div className="detail-group">
                                <h3 className="detail-group-title">Extracted Data</h3>
                                <DetailRow label="Vendor"         value={invoice.vendorName} />
                                <DetailRow label="Invoice No."    value={invoice.invoiceNumber} />
                                <DetailRow label="Invoice Date"   value={fmt.date(invoice.invoiceDate)} />
                                <DetailRow label="Due Date"       value={fmt.date(ed.dueDate)} />
                                <DetailRow label="Total Amount"   value={fmt.amount(invoice.totalAmount, invoice.currency)} highlight />
                                <DetailRow label="Subtotal"       value={fmt.amount(ed.subTotal, invoice.currency)} />
                                <DetailRow label="Tax"            value={fmt.amount(ed.taxAmount, invoice.currency)} />
                                <DetailRow label="Category"       value={invoice.category} />
                                <DetailRow label="Customer"       value={ed.customerName} />
                                <DetailRow label="Vendor Address" value={ed.vendorAddress} />
                            </div>
                            <div className="detail-group">
                                <h3 className="detail-group-title">Processing Info</h3>
                                <DetailRow label="Status"    value={<StatusBadge status={invoice.processingStatus} />} />
                                <DetailRow label="Uploaded"  value={`${fmt.date(invoice.uploadedDateTime)} ${fmt.time(invoice.uploadedDateTime)}`} />
                                <DetailRow label="Started"   value={fmt.time(invoice.processingStartTime)} />
                                <DetailRow label="Completed" value={fmt.time(invoice.processingEndTime)} />
                                <DetailRow label="Duration"  value={fmt.ms(invoice.processingDurationMs)} />
                                <DetailRow label="SLA"       value={invoice.processingStatus === 'Completed' ? (invoice.slaBreached ? '⚠ Breached (>2min)' : '✓ Within SLA') : '—'} />
                                <DetailRow label="Duplicate" value={invoice.isDuplicate ? `Yes → ${invoice.duplicateOfInvoiceId}` : 'No'} />
                                {invoice.errorMessage && <DetailRow label="Error" value={invoice.errorMessage} error />}
                            </div>
                        </div>
                        <div className="detail-col">
                            <div className="detail-group logs-group">
                                <h3 className="detail-group-title">Processing Logs</h3>
                                <div className="logs-scroll">
                                    {logs.length === 0 ? (
                                        <p className="no-logs">No logs available</p>
                                    ) : logs.map((log, i) => (
                                        <div key={i} className={`log-entry log-${log.logLevel?.toLowerCase()}`}>
                                            <span className="log-time">{fmt.time(log.logDateTime)}</span>
                                            <span className={`log-level log-level-${log.logLevel?.toLowerCase()}`}>{log.logLevel}</span>
                                            <span className="log-msg">{log.logMessage}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DetailRow = ({ label, value, highlight, error }) => (
    <div className={`detail-row ${highlight ? 'row-highlight' : ''} ${error ? 'row-error' : ''}`}>
        <span className="detail-label">{label}</span>
        <span className="detail-value">{value || <span className="null-val">—</span>}</span>
    </div>
);

export default function App() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [view, setView] = useState('dashboard');

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getInvoices();
            setInvoices(data.invoices || []);
            setLastRefresh(new Date());
        } catch (e) {
            console.error('Failed to load invoices:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInvoices();
        const interval = setInterval(loadInvoices, 30000);
        return () => clearInterval(interval);
    }, [loadInvoices]);

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="logo-mark">IP</div>
                    <div className="logo-text">
                        <span className="logo-title">InvoiceAI</span>
                        <span className="logo-sub">Azure Powered</span>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                        Dashboard
                    </button>
                    <button className={`nav-item ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Upload
                    </button>
                    <button className={`nav-item ${view === 'monitoring' ? 'active' : ''}`} onClick={() => setView('monitoring')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Monitoring
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <div className="api-status"><span className="status-dot" /><span>API Connected</span></div>
                    {lastRefresh && <span className="last-refresh">Refreshed {fmt.time(lastRefresh)}</span>}
                    <button className="btn-refresh" onClick={loadInvoices}>↻ Refresh</button>
                </div>
            </aside>

            <main className="main">
                <header className="top-bar">
                    <div className="top-bar-left">
                        <h1 className="page-title">
                            {view === 'dashboard' ? 'Invoice Registry' : view === 'upload' ? 'Upload Invoice' : 'Monitoring & SLA'}
                        </h1>
                        <span className="page-sub">Intelligent Cloud-Based Processing System</span>
                    </div>
                    <div className="top-bar-right">
                        <span className="env-tag">AZURE FUNCTIONS</span>
                        <span className="env-tag">COSMOS DB</span>
                        <span className="env-tag">APP INSIGHTS</span>
                    </div>
                </header>
                <div className="content">
                    {view === 'upload' && <UploadZone onUploadSuccess={() => { loadInvoices(); setView('dashboard'); }} />}
                    {view === 'dashboard' && (<><StatsBar invoices={invoices} /><InvoiceTable invoices={invoices} onSelect={setSelected} loading={loading} /></>)}
                    {view === 'monitoring' && <MonitoringDashboard />}
                </div>
            </main>

            {selected && <InvoiceModal invoice={selected} onClose={() => { setSelected(null); loadInvoices(); }} />}
        </div>
    );
}