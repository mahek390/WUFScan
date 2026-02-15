import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Shield, AlertTriangle, Clock, FileText, Activity, Eye, Zap } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
  const [scans, setScans] = useState([]);
  const [timeRange, setTimeRange] = useState('all');
  const [redactionStats, setRedactionStats] = useState([]);

  useEffect(() => {
    fetchHistory();
    fetchRedactionStats();
    const interval = setInterval(() => {
      fetchHistory();
      fetchRedactionStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('wufscan_user') || '{}');
      const response = await fetch('http://localhost:5001/api/history', {
        headers: { 'X-User-Id': user.userId || 'anonymous' }
      });
      const data = await response.json();
      setScans(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchRedactionStats = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('wufscan_user') || '{}');
      const response = await fetch('http://localhost:5001/api/redaction-stats', {
        headers: { 'X-User-Id': user.userId || 'anonymous' }
      });
      const data = await response.json();
      setRedactionStats(data);
    } catch (error) {
      console.error('Failed to fetch redaction stats:', error);
    }
  };

  const filterByTime = (scans) => {
    if (timeRange === 'all') return scans;
    const now = Date.now();
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return scans.filter(s => now - new Date(s.timestamp).getTime() < ranges[timeRange]);
  };

  const filteredScans = filterByTime(scans);

  const stats = {
    total: filteredScans.length,
    critical: filteredScans.filter(s => s.riskLevel === 'CRITICAL').length,
    high: filteredScans.filter(s => s.riskLevel === 'HIGH').length,
    medium: filteredScans.filter(s => s.riskLevel === 'MEDIUM').length,
    low: filteredScans.filter(s => s.riskLevel === 'LOW').length,
    avgRisk: filteredScans.length ? Math.round(filteredScans.reduce((sum, s) => sum + s.riskScore, 0) / filteredScans.length) : 0,
    totalFindings: filteredScans.reduce((sum, s) => sum + (s.regexFindings?.length || 0) + (s.aiFindings?.length || 0), 0)
  };

  const threatTypes = {};
  filteredScans.forEach(scan => {
    scan.regexFindings?.forEach(f => {
      threatTypes[f.type] = (threatTypes[f.type] || 0) + 1;
    });
  });

  const topThreats = Object.entries(threatTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const detectionComparison = {
    regexOnly: filteredScans.filter(s => (s.regexFindings?.length || 0) > 0 && (s.aiFindings?.length || 0) === 0).length,
    aiOnly: filteredScans.filter(s => (s.aiFindings?.length || 0) > 0 && (s.regexFindings?.length || 0) === 0).length,
    both: filteredScans.filter(s => (s.regexFindings?.length || 0) > 0 && (s.aiFindings?.length || 0) > 0).length,
    totalRegexFindings: filteredScans.reduce((sum, s) => sum + (s.regexFindings?.length || 0), 0),
    totalAiFindings: filteredScans.reduce((sum, s) => sum + (s.aiFindings?.length || 0), 0)
  };

  const topRedacted = redactionStats.slice(0, 5);

  const riskDistribution = [
    { level: 'CRITICAL', count: stats.critical, color: '#e63946' },
    { level: 'HIGH', count: stats.high, color: '#f59e0b' },
    { level: 'MEDIUM', count: stats.medium, color: '#cda45e' },
    { level: 'LOW', count: stats.low, color: '#10b981' }
  ];

  const maxCount = Math.max(...riskDistribution.map(r => r.count), 1);

  const recentActivity = filteredScans.slice(0, 5);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <BarChart3 size={40} />
          <div>
            <h1>Intelligence Dashboard</h1>
            <p className="subtitle">Your Personal Threat Analysis</p>
          </div>
        </div>
        <div className="time-filter">
          <button className={timeRange === '24h' ? 'active' : ''} onClick={() => setTimeRange('24h')}>24H</button>
          <button className={timeRange === '7d' ? 'active' : ''} onClick={() => setTimeRange('7d')}>7D</button>
          <button className={timeRange === '30d' ? 'active' : ''} onClick={() => setTimeRange('30d')}>30D</button>
          <button className={timeRange === 'all' ? 'active' : ''} onClick={() => setTimeRange('all')}>ALL</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon"><Shield size={32} /></div>
          <div className="metric-content">
            <div className="metric-value">{stats.total}</div>
            <div className="metric-label">Total Investigations</div>
          </div>
        </div>

        <div className="metric-card danger">
          <div className="metric-icon"><AlertTriangle size={32} /></div>
          <div className="metric-content">
            <div className="metric-value">{stats.critical + stats.high}</div>
            <div className="metric-label">High Priority Threats</div>
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-icon"><Activity size={32} /></div>
          <div className="metric-content">
            <div className="metric-value">{stats.avgRisk}</div>
            <div className="metric-label">Average Risk Score</div>
          </div>
        </div>

        <div className="metric-card info">
          <div className="metric-icon"><FileText size={32} /></div>
          <div className="metric-content">
            <div className="metric-value">{stats.totalFindings}</div>
            <div className="metric-label">Evidence Items Found</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <PieChart size={24} />
            <h3>Risk Distribution</h3>
          </div>
          <div className="chart-content">
            {stats.total === 0 ? (
              <div className="empty-chart">No data available</div>
            ) : (
              <div className="bar-chart">
                {riskDistribution.map(item => (
                  <div key={item.level} className="bar-item">
                    <div className="bar-label">
                      <span>{item.level}</span>
                      <span className="bar-count">{item.count}</span>
                    </div>
                    <div className="bar-track">
                      <div 
                        className="bar-fill" 
                        style={{ 
                          width: `${(item.count / maxCount) * 100}%`,
                          background: item.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <TrendingUp size={24} />
            <h3>Top Threat Types</h3>
          </div>
          <div className="chart-content">
            {topThreats.length === 0 ? (
              <div className="empty-chart">No threats detected</div>
            ) : (
              <div className="threat-list">
                {topThreats.map(([type, count], idx) => (
                  <div key={type} className="threat-item">
                    <div className="threat-rank">#{idx + 1}</div>
                    <div className="threat-info">
                      <div className="threat-name">{type.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="threat-bar">
                        <div 
                          className="threat-fill" 
                          style={{ width: `${(count / topThreats[0][1]) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="threat-count">{count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <Zap size={24} />
            <h3>Detection Method Analysis</h3>
          </div>
          <div className="chart-content">
            {stats.total === 0 ? (
              <div className="empty-chart">No data available</div>
            ) : (
              <div className="detection-analysis">
                <div className="detection-stats">
                  <div className="detection-item regex">
                    <div className="detection-label">Regex Patterns</div>
                    <div className="detection-value">{detectionComparison.totalRegexFindings}</div>
                    <div className="detection-sublabel">{detectionComparison.regexOnly} scans only</div>
                  </div>
                  <div className="detection-divider">VS</div>
                  <div className="detection-item ai">
                    <div className="detection-label">AI Detection</div>
                    <div className="detection-value">{detectionComparison.totalAiFindings}</div>
                    <div className="detection-sublabel">{detectionComparison.aiOnly} scans only</div>
                  </div>
                </div>
                <div className="detection-overlap">
                  <Shield size={20} />
                  <span>Both methods detected threats in <strong>{detectionComparison.both}</strong> scans</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <Eye size={24} />
            <h3>Most Redacted Data Types</h3>
          </div>
          <div className="chart-content">
            {topRedacted.length === 0 ? (
              <div className="empty-chart">No redaction data</div>
            ) : (
              <div className="threat-list">
                {topRedacted.map((item, idx) => (
                  <div key={item.type} className="threat-item">
                    <div className="threat-rank">#{idx + 1}</div>
                    <div className="threat-info">
                      <div className="threat-name">{item.type.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="threat-bar">
                        <div 
                          className="threat-fill redaction" 
                          style={{ width: `${(item.count / topRedacted[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="threat-count">{item.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="activity-section">
        <div className="section-header">
          <Clock size={24} />
          <h3>Recent Investigations</h3>
        </div>
        {recentActivity.length === 0 ? (
          <div className="empty-activity">
            <FileText size={48} />
            <p>No recent investigations</p>
          </div>
        ) : (
          <div className="activity-timeline">
            {recentActivity.map((scan) => (
              <div key={scan.id} className="timeline-item">
                <div className="timeline-marker" style={{ 
                  background: scan.riskLevel === 'CRITICAL' ? '#c41e3a' : 
                              scan.riskLevel === 'HIGH' ? '#d4af37' : 
                              scan.riskLevel === 'MEDIUM' ? '#8b7355' : '#556b2f'
                }} />
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-file">{scan.filename}</span>
                    <span className={`timeline-badge ${scan.riskLevel.toLowerCase()}`}>
                      {scan.riskLevel}
                    </span>
                  </div>
                  <div className="timeline-details">
                    <span>Risk: {scan.riskScore}/100</span>
                    <span>•</span>
                    <span>{(scan.regexFindings?.length || 0) + (scan.aiFindings?.length || 0)} findings</span>
                    <span>•</span>
                    <span>{new Date(scan.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
