import React from 'react';
import { useLogs, Logger } from './LogStore';

export default function LogPanel() {
    const logs = useLogs();

    return (
        <div className="log-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    className="btn"
                    onClick={() => Logger.clear()}
                    style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '11px', padding: '4px 8px' }}
                >
                    Limpiar log
                </button>
            </div>

            <div className="log-entries" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {logs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <span className="icon" style={{ opacity: 0.3, fontSize: '24px' }}>📝</span>
                        <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Sin peticiones registradas</p>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '10px',
                            marginBottom: '8px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <strong style={{ fontSize: '11px', color: 'var(--accent)' }}>{log.title}</strong>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                    {log.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                            {log.subtitle && <p style={{ fontSize: '11px', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>{log.subtitle}</p>}
                            {log.badges && log.badges.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {log.badges.map((b, i) => (
                                        <span key={i} style={{
                                            background: 'var(--bg-tertiary)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border)'
                                        }}>
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
