import React, { useState } from 'react';
import axios from 'axios';
import { Shield, Upload, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResults(null);
  };

  const handleScan = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5000/api/scan', formData);
      setResults(response.data);
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Scan failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStampClass = (level) => `stamp-text stamp-${level.toLowerCase()}`;
  const getRiskColor = (level) => {
    const colors = {
      CRITICAL: '#c41e3a',
      HIGH: '#cc5500',
      MEDIUM: '#d4a017',
      LOW: '#2d5016'
    };
    return colors[level] || '#999';
  };

  const regexFindings = results?.findings || [];
  const aiInsights = results?.aiInsights || null;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Shield size={40} />
          <h1 className="logo">DataGuardian</h1>
          <p className="tagline">"Your Last Line of Defense Before You Hit Send"</p>
        </div>
      </header>

      <main className="container">
        {/* Upload Section */}
        <section className="upload-section">
          <FileText size={64} className="upload-icon" />
          <h2>Submit Document for Security Screening</h2>
          <p style={{ margin: '1rem 0', color: '#999' }}>
            Upload any document to scan for sensitive information
          </p>
          
          <input
            type="file"
            id="file-input"
            className="file-input"
            onChange={handleFileChange}
            accept=".txt,.pdf,.doc,.docx,.yaml,.yml,.json,.env"
          />
          
          <label htmlFor="file-input">
            <button className="upload-btn" onClick={() => document.getElementById('file-input').click()}>
              <Upload size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
              Select File
            </button>
          </label>

          {file && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: '#e8dcc4', marginBottom: '1rem' }}>
                Selected: <strong>{file.name}</strong>
              </p>
              <button className="upload-btn" onClick={handleScan} disabled={loading}>
                {loading ? 'Scanning...' : 'Begin Security Scan'}
              </button>
            </div>
          )}
        </section>

        {/* Loading Animation */}
        {loading && (
          <div className="loading">
            <Shield size={64} className="spinner" />
            <h3>Conducting Security Analysis...</h3>
            <p style={{ color: '#999', marginTop: '0.5rem' }}>
              Examining document for sensitive data
            </p>
          </div>
        )}

        {/* Results Section */}
        {results && !loading && (
          <section className="results-section">
            <div className="stamp">
              <div className={getStampClass(results.riskLevel)}>
                {results.riskLevel === 'LOW' ? 'CLEARED' : 'SECURITY RISK'}
              </div>
            </div>

            <div className="risk-score">
              <div className="risk-gauge" style={{ color: getRiskColor(results.riskLevel) }}>
                {results.riskScore}/100
              </div>
              <div className="risk-label" style={{ color: getRiskColor(results.riskLevel) }}>
                Threat Level: {results.riskLevel}
              </div>
            </div>

            {/* Regex Findings */}
            {regexFindings.length > 0 && (
              <div className="findings regex-findings">
                <h3 className="section-title">
                  <AlertTriangle size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Pattern Matches ({regexFindings.length})
                </h3>
                {regexFindings.map((finding, index) => (
                  <div key={index} className={`finding-card ${finding.severity.toLowerCase()}`}>
                    <div className="finding-header">
                      <span className="finding-type">
                        {finding.type.toUpperCase().replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className={`severity-badge severity-${finding.severity.toLowerCase()}`}>
                        {finding.severity}
                      </span>
                    </div>
                    <div className="finding-content">
                      Content: <code>{finding.content}</code><br />
                      Confidence: {finding.confidence}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Insights */}
            {aiInsights && (
              <div className="findings ai-findings">
                <h3 className="section-title ai-title">
                  🧠 AI Detective Analysis
                </h3>
                <div className="ai-report">
                  {aiInsights}
                </div>
              </div>
            )}

            {/* No Issues */}
            {regexFindings.length === 0 && !aiInsights && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <CheckCircle size={64} style={{ color: '#2d5016', margin: '0 auto 1rem' }} />
                <h3 style={{ color: '#2d5016' }}>No Security Issues Found</h3>
                <p style={{ color: '#999', marginTop: '0.5rem' }}>
                  This document is cleared for sharing
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
