import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, FileText, TrendingUp } from 'lucide-react';
import './History.css';

function History() {
  const [scans, setScans] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/history');
      const data = await response.json();
      setScans(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
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
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'CRITICAL' ? 'active' : ''} onClick={() => setFilter('CRITICAL')}>Critical</button>
        <button className={filter === 'HIGH' ? 'active' : ''} onClick={() => setFilter('HIGH')}>High</button>
        <button className={filter === 'MEDIUM' ? 'active' : ''} onClick={() => setFilter('MEDIUM')}>Medium</button>
        <button className={filter === 'LOW' ? 'active' : ''} onClick={() => setFilter('LOW')}>Low</button>
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
            <div key={scan.id} className={`scan-card risk-${scan.riskLevel.toLowerCase()}`}>
              <div className="scan-header">
                <div className="scan-info">
                  <FileText size={20} />
                  <span className="filename">{scan.filename}</span>
                </div>
                <span className={`risk-badge ${scan.riskLevel.toLowerCase()}`}>
                  {scan.riskLevel}
                </span>
              </div>
              <div className="scan-details">
                <div className="detail">
                  <span className="label">Risk Score:</span>
                  <span className="value">{scan.riskScore}/100</span>
                </div>
                <div className="detail">
                  <span className="label">Issues Found:</span>
                  <span className="value">{scan.findingsCount}</span>
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
