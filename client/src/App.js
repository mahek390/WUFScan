import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Upload, AlertTriangle, CheckCircle, FileText, Download, Eye, Clock } from 'lucide-react';
import History from './History';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedFindings, setSelectedFindings] = useState([]);
  const [redactionStyle, setRedactionStyle] = useState('full');
  const [showPreview, setShowPreview] = useState(false);
  const [redactedText, setRedactedText] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#history') {
      setActiveTab('history');
    }
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResults(null);
    setSelectedFindings([]);
    setShowPreview(false);
  };

  const handleScan = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5001/api/scan', formData);
      setResults(response.data);
      setSelectedFindings(response.data.findings.map((_, i) => i));
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

  const regexFindings = results?.regexFindings || [];
  const aiSummary = results?.aiSummary || null;
  const aiFindings = results?.aiFindings || [];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Shield size={40} />
          <h1 className="logo">DataGuardian</h1>
          <div className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanner')}
            >
              <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Scanner
            </button>
            <button 
              className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              History
            </button>
          </div>
          <p className="tagline">"Your Last Line of Defense Before You Hit Send"</p>
        </div>
      </header>

      {activeTab === 'scanner' ? (
        <main className="container">
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
              
              {/* Score Breakdown */}
              <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c41e3a' }}>
                    {results.regexScore || 0}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#999' }}>Regex Score</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6495ed' }}>
                    {results.aiScore || 0}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#999' }}>AI Score</div>
                </div>
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
                      <input 
                        type="checkbox" 
                        checked={selectedFindings.includes(index)}
                        onChange={() => toggleFinding(index)}
                        style={{ marginRight: '10px' }}
                      />
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

                <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#1a1a1a', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Redaction Options</h4>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ marginRight: '1rem' }}>
                      <input type="radio" value="full" checked={redactionStyle === 'full'} onChange={(e) => setRedactionStyle(e.target.value)} />
                      {' '}[REDACTED]
                    </label>
                    <label style={{ marginRight: '1rem' }}>
                      <input type="radio" value="partial" checked={redactionStyle === 'partial'} onChange={(e) => setRedactionStyle(e.target.value)} />
                      {' '}Partial (xxx***xxx)
                    </label>
                    <label style={{ marginRight: '1rem' }}>
                      <input type="radio" value="asterisk" checked={redactionStyle === 'asterisk'} onChange={(e) => setRedactionStyle(e.target.value)} />
                      {' '}Asterisks (***)
                    </label>
                    <label>
                      <input type="radio" value="block" checked={redactionStyle === 'block'} onChange={(e) => setRedactionStyle(e.target.value)} />
                      {' '}Black Bars (███)
                    </label>
                  </div>
                  <button className="upload-btn" onClick={handleRedact} disabled={selectedFindings.length === 0}>
                    <Eye size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                    Preview Redacted Document
                  </button>
                </div>
              </div>
            )}

            {/* AI Insights */}
            {(aiSummary || aiFindings.length > 0) && (
              <div className="findings ai-findings">
                <h3 className="section-title ai-title">
                  🧠 AI Detective Analysis
                </h3>
                {aiSummary && (
                  <div className="ai-report">
                    <strong>Summary:</strong> {aiSummary}
                  </div>
                )}
                {aiFindings.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    {aiFindings.map((issue, index) => (
                      <div key={index} className={`finding-card ${issue.severity.toLowerCase()}`}>
                        <div className="finding-header">
                          <span className="finding-type">{issue.type}</span>
                          <span className={`severity-badge severity-${issue.severity.toLowerCase()}`}>
                            {issue.severity}
                          </span>
                        </div>
                        <div className="finding-content">
                          {issue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No Issues */}
            {regexFindings.length === 0 && !aiSummary && aiFindings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <CheckCircle size={64} style={{ color: '#2d5016', margin: '0 auto 1rem' }} />
                <h3 style={{ color: '#2d5016' }}>No Security Issues Found</h3>
                <p style={{ color: '#999', marginTop: '0.5rem' }}>
                  This document is cleared for sharing
                </p>
              </div>
            )}

            {showPreview && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#1a1a1a', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '1rem' }}>Redacted Document Preview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <h4 style={{ color: '#999', marginBottom: '0.5rem' }}>Original</h4>
                    <pre style={{ background: '#0d0d0d', padding: '1rem', borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
                      {results.originalText}
                    </pre>
                  </div>
                  <div>
                    <h4 style={{ color: '#999', marginBottom: '0.5rem' }}>Redacted</h4>
                    <pre style={{ background: '#0d0d0d', padding: '1rem', borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
                      {redactedText}
                    </pre>
                  </div>
                </div>
                <button className="upload-btn" onClick={downloadRedacted} style={{ marginTop: '1rem' }}>
                  <Download size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Download Redacted File
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      ) : (
        <History />
      )}
    </div>
  );
}

export default App;
