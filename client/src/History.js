import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, FileText, TrendingUp, Trash2, Upload } from 'lucide-react';
import './History.css';

function History({ onViewScan }) {
  const [scans, setScans] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('wufscan_user') || '{}');
      const response = await fetch('http://localhost:5001/api/history', {
        headers: { 'X-User-Id': user.userId || 'anonymous' }
      });
      const data = await response.json();
      console.log('Fetched history:', data.length, 'scans');
      setScans(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const handleDelete = async (e, scanId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this scan record?')) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/history/${scanId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setScans(scans.filter(s => s.id !== scanId));
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete record');
    }
  };

  const handleReupload = (e, scan) => {
    e.stopPropagation();
    onViewScan({ ...scan, reupload: true });
  };

  const filteredScans = scans.filter(scan => 
    filter === 'all' || scan.riskLevel === filter
  );

  const stats = {
    total: scans.length,
    critical: scans.filter(s => s.riskLevel === 'CRITICAL').length,
    prevented: scans.filter(s => s.riskScore > 50).length,
    avgRisk: scans.length ? Math.round(scans.reduce((sum, s) => sum + s.riskScore, 0) / scans.length) : 0
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <Clock size={40} />
        <h1>Case Files Archive</h1>
        <p className="subtitle">Security Screening History</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <FileText size={32} />
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Scans</div>
        </div>
        <div className="stat-card critical">
          <AlertTriangle size={32} />
          <div className="stat-value">{stats.critical}</div>
          <div className="stat-label">Critical Threats</div>
        </div>
        <div className="stat-card success">
          <CheckCircle size={32} />
          <div className="stat-value">{stats.prevented}</div>
          <div className="stat-label">Breaches Prevented</div>
        </div>
        <div className="stat-card">
          <TrendingUp size={32} />
          <div className="stat-value">{stats.avgRisk}</div>
          <div className="stat-label">Avg Risk Score</div>
        </div>
      </div>

      <div className="filter-bar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({scans.length})</button>
        <button className={filter === 'CRITICAL' ? 'active' : ''} onClick={() => setFilter('CRITICAL')}>Critical ({stats.critical})</button>
        <button className={filter === 'HIGH' ? 'active' : ''} onClick={() => setFilter('HIGH')}>High ({scans.filter(s => s.riskLevel === 'HIGH').length})</button>
        <button className={filter === 'MEDIUM' ? 'active' : ''} onClick={() => setFilter('MEDIUM')}>Medium ({scans.filter(s => s.riskLevel === 'MEDIUM').length})</button>
        <button className={filter === 'LOW' ? 'active' : ''} onClick={() => setFilter('LOW')}>Low ({scans.filter(s => s.riskLevel === 'LOW').length})</button>
      </div>

      <div className="scans-list">
        {filteredScans.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>No Case Files Found</h3>
            <p>Start scanning documents to build your archive</p>
          </div>
        ) : (
          filteredScans.map(scan => (
            <div 
              key={scan.id} 
              className={`scan-card risk-${scan.riskLevel.toLowerCase()}`}
              onClick={() => onViewScan(scan)}
              style={{ cursor: 'pointer' }}
            >
              <div className="scan-header">
                <div className="scan-info">
                  <FileText size={20} />
                  <span className="filename">{scan.filename}</span>
                  {scan.username && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: '#6a6a60',
                      marginLeft: '0.5rem'
                    }}>
                      by {scan.username}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                    className="icon-btn reupload-btn"
                    onClick={(e) => handleReupload(e, scan)}
                    title="Re-upload and edit"
                  >
                    <Upload size={16} />
                  </button>
                  <button 
                    className="icon-btn delete-btn"
                    onClick={(e) => handleDelete(e, scan.id)}
                    title="Delete record"
                  >
                    <Trash2 size={16} />
                  </button>
                  <span className={`risk-badge ${scan.riskLevel.toLowerCase()}`}>
                    {scan.riskLevel}
                  </span>
                </div>
              </div>
              <div className="scan-details">
                <div className="detail">
                  <span className="label">Risk Score:</span>
                  <span className="value">{scan.riskScore}/100</span>
                </div>
                <div className="detail">
                  <span className="label">Issues Found:</span>
                  <span className="value">{(scan.regexFindings?.length || 0) + (scan.aiFindings?.length || 0)}</span>
                </div>
                <div className="detail">
                  <span className="label">Scanned:</span>
                  <span className="value">{new Date(scan.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default History;
