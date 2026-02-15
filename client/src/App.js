import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Upload, AlertTriangle, CheckCircle, FileText, Eye, Clock, Download, BarChart3, LogOut, User } from 'lucide-react';
import History from './History';
import Dashboard from './Dashboard';
import Login from './Login';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('scanner');
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedFindings, setSelectedFindings] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [redactionStyle, setRedactionStyle] = useState('full');
  const [showPreview, setShowPreview] = useState(false);
  const [redactedText, setRedactedText] = useState('');
  const [originalFile, setOriginalFile] = useState(null);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [wantsNotification, setWantsNotification] = useState(false);

  const handleViewScan = (scan) => {
    setResults(scan);
    setActiveTab('scanner');
    setFile(null);
    const types = new Set(scan.regexFindings?.map(f => f.type) || []);
    setSelectedTypes(types);
    setFileText(scan.extractedText || '');
    
    if (scan.reupload) {
      setOriginalFile({ name: scan.filename });
      alert('Upload a new version of this file to re-scan');
    }
    
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('wufscan_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    const hash = window.location.hash;
    if (hash === '#history') {
      setActiveTab('history');
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('wufscan_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('wufscan_user');
    setResults(null);
    setFile(null);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setOriginalFile(selectedFile);
    setResults(null);
    setSelectedFindings([]);
    setShowPreview(false);
    setFileText('');

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => setFileText(e.target.result);
      if (selectedFile.type.match(/text.*/) || selectedFile.name.match(/\.(json|xml|js|py|env|yml|yaml|md)$/)) {
        reader.readAsText(selectedFile);
      } else {
        setFileText("(Extracting text from document...)");
      }
    }
  };

  const handleScan = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5001/api/scan', formData, {
        headers: { 
          'X-Notification-Email': wantsNotification ? notificationEmail : '',
          'X-User-Id': user?.userId || 'anonymous',
          'X-Username': user?.username || 'Anonymous'
        }
      });
      setResults(response.data);
      const types = new Set(response.data.regexFindings.map(f => f.type));
      setSelectedTypes(types);
      
      if (response.data.extractedText) {
        setFileText(response.data.extractedText);
      }
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Scan failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const getSelectedFindings = () => {
    if (selectedTypes.size === 0) return [];
    return results.regexFindings.filter(f => selectedTypes.has(f.type));
  };

  const handleRedact = async () => {
    const findingsToRedact = getSelectedFindings();
    
    if (findingsToRedact.length === 0) {
      alert('Please select at least one finding type to redact.');
      return;
    }

    if (!fileText || fileText.trim().length === 0) {
      alert('No text available to redact. The file may be empty or unsupported.');
      return;
    }
    
    try {
      const response = await axios.post('http://localhost:5001/api/redact', {
        text: fileText, 
        findings: findingsToRedact,
        redactionStyle: redactionStyle
      });

      setRedactedText(response.data.redactedText);
      setShowPreview(true);
    } catch (error) {
      console.error('Redaction failed:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Redaction Failed: ${errorMsg}`);
    }
  };

  const handleDownload = async () => {
    if (!redactedText || redactedText.trim().length === 0) {
      alert('No redacted text available. Please generate redacted document first.');
      return;
    }

    if (!originalFile) {
      alert('Original file information is missing. Please scan a file first.');
      return;
    }

    try {
      const fileExt = originalFile.name.split('.').pop().toLowerCase();
      let fileType = 'text';
      
      if (fileExt === 'pdf') fileType = 'pdf';
      else if (fileExt === 'docx') fileType = 'docx';
      
      const response = await axios.post('http://localhost:5001/api/download-redacted', {
        redactedText: redactedText,
        originalFilename: originalFile.name,
        fileType: fileType
      }, {
        responseType: 'blob',
        timeout: 30000
      });
      
      if (!response.data || response.data.size === 0) {
        throw new Error('Server returned empty file');
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `redacted_${originalFile.name}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert('✓ Redacted document downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      let errorMsg = 'Unknown error occurred';
      
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Download timeout - file may be too large';
      } else if (error.response?.status === 500) {
        errorMsg = 'Server error generating file';
      } else if (error.response?.status === 404) {
        errorMsg = 'Download endpoint not found';
      } else if (!navigator.onLine) {
        errorMsg = 'No internet connection';
      } else {
        errorMsg = error.message || 'Failed to generate download';
      }
      
      alert(`Download Failed: ${errorMsg}\n\nTroubleshooting:\n- Check if server is running on port 5001\n- Verify pdf-lib is installed (npm install pdf-lib)\n- Try a smaller file\n- Check browser console for details`);
    }
  };

  const highlightRedactions = (text) => {
    if (!text) return null;
    const findingsToRedact = getSelectedFindings();
    let parts = [{ text, isRedacted: false }];

    findingsToRedact.forEach(finding => {
      const match = finding.fullMatch || finding.content;
      if (!match) return;

      const newParts = [];
      parts.forEach(part => {
        if (part.isRedacted) {
          newParts.push(part);
        } else {
          const segments = part.text.split(match);
          segments.forEach((segment, i) => {
            if (segment) newParts.push({ text: segment, isRedacted: false });
            if (i < segments.length - 1) {
              newParts.push({ text: match, isRedacted: true });
            }
          });
        }
      });
      parts = newParts;
    });

    return parts.map((part, i) => 
      part.isRedacted ? (
        <mark key={i} style={{ background: '#c41e3a', color: '#fff', padding: '2px 4px', borderRadius: '2px' }}>
          {part.text}
        </mark>
      ) : part.text
    );
  };

  const getStampClass = (level) => {
    if (!level) return 'stamp-text';
    return `stamp-text stamp-${level.toLowerCase()}`;
  };

  const getRiskColor = (level) => {
    const colors = {
      CRITICAL: '#e63946',
      HIGH: '#f59e0b',
      MEDIUM: '#cda45e',
      LOW: '#10b981'
    };
    return colors[level] || '#999';
  };

  const regexFindings = results?.regexFindings || [];
  const aiSummary = results?.aiSummary || null;
  const aiFindings = results?.aiFindings || [];

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      {/* Crime Scene Tape */}
      <div style={{
        background: 'repeating-linear-gradient(45deg, #cda45e, #cda45e 30px, #0a0a0a 30px, #0a0a0a 60px)',
        padding: '0.5rem 0',
        overflow: 'hidden',
        borderBottom: '2px solid #e0b76f',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#0a0a0a',
          letterSpacing: '0.2em',
          textAlign: 'center',
          animation: 'scrollTape 20s linear infinite',
          whiteSpace: 'nowrap'
        }}>
          ⚠ CONFIDENTIAL ⚠ WUFSCAN BUREAU ⚠ CLASSIFIED EVIDENCE ⚠ DO NOT CROSS ⚠ INVESTIGATION IN PROGRESS ⚠ CONFIDENTIAL ⚠ WUFSCAN BUREAU ⚠
        </div>
      </div>

      <header className="header">
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Shield size={40} />
            <div>
              <h1 className="logo" style={{ marginBottom: '0.25rem' }}>WufScan</h1>
              <div style={{ 
                fontFamily: "'Courier Prime', monospace",
                fontSize: '0.75rem',
                color: '#a8a8a0',
                letterSpacing: '0.15em',
                textTransform: 'uppercase'
              }}>
                Detective Division
              </div>
            </div>
          </div>
          <div className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanner')}
            >
              <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              New Case
            </button>
            <button 
              className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Dashboard
            </button>
            <button 
              className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Archive
            </button>
          </div>
          
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              padding: '0.5rem 1rem',
              background: 'rgba(168, 168, 160, 0.1)',
              border: '1px solid #6a6a60',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <User size={16} style={{ color: '#a8a8a0' }} />
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#a8a8a0',
                  fontFamily: "'Courier Prime', monospace"
                }}>
                  {user.username}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid #6a6a60',
                borderRadius: '0.375rem',
                color: '#a8a8a0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontFamily: "'Courier Prime', monospace",
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(168, 168, 160, 0.1)';
                e.target.style.borderColor = '#a8a8a0';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = '#6a6a60';
              }}
            >
              <LogOut size={16} />
              Exit
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'scanner' ? (
        <main className="container">
          {/* Case Board Header with Pinned Note */}
          <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              background: '#e8e8e0',
              color: '#0a0a0a',
              padding: '2rem 3rem',
              borderRadius: '0.25rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              position: 'relative',
              transform: 'rotate(-1deg)',
              maxWidth: '600px',
              textAlign: 'center'
            }}>
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%) rotate(-45deg)',
                width: '20px',
                height: '20px',
                background: '#e63946',
                borderRadius: '50% 50% 50% 0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
              }}></div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '2rem',
                marginBottom: '0.5rem',
                color: '#0a0a0a'
              }}>
                📋 Active Investigation
              </h1>
              <p style={{ color: '#1a1a1a', fontSize: '1rem' }}>
                Submit evidence for forensic PII analysis
              </p>
            </div>
          </div>

          <section className="upload-section">
            {/* Fingerprint Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem',
              color: '#cda45e',
              opacity: 0.4,
              transition: 'all 0.4s'
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </div>

            <h2>Evidence Collection</h2>
            <p style={{ margin: '1rem 0', color: '#a8a8a0', fontWeight: 700 }}>
              ⚠ All submissions are treated as classified material
            </p>
            
            <input
              type="file"
              id="file-input"
              className="file-input"
              onChange={handleFileChange}
            />
            
            <label htmlFor="file-input">
              <button className="upload-btn" onClick={() => document.getElementById('file-input')?.click()}>
                <Upload size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Submit Evidence
              </button>
            </label>

            <div style={{ marginTop: '1.5rem', color: '#6a6a60', fontSize: '0.875rem', letterSpacing: '0.05em' }}>
              Accepted: .TXT, .PDF, .DOCX, .CSV, .py, .js, .java, .cpp, .c, .xml, .html, .tex, .yaml, .yml, .env, images, videos
            </div>

            {file && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ color: '#e8e8e0', marginBottom: '1rem' }}>
                  📁 Selected: <strong>{file.name}</strong>
                </p>
                <div style={{ marginBottom: '1rem', padding: '1rem', background: '#1a1a1a', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={wantsNotification}
                      onChange={(e) => setWantsNotification(e.target.checked)}
                      style={{ marginRight: '10px', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#e8e8e0' }}>🔔 Send alert if sensitive data detected</span>
                  </label>
                  {wantsNotification && (
                    <input
                      type="email"
                      placeholder="Enter investigator email address"
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#0a0a0a',
                        border: '1px solid #2a2a2a',
                        borderRadius: '4px',
                        color: '#e8e8e0',
                        fontSize: '1rem'
                      }}
                    />
                  )}
                </div>
                <button className="upload-btn" onClick={handleScan} disabled={loading}>
                  {loading ? '🔍 Investigating...' : '🕵️ Begin Investigation'}
                </button>
              </div>
            )}
          </section>

          {loading && (
            <div className="loading">
              <Shield size={64} className="spinner" />
              <h3>Investigation in Progress...</h3>
              <p style={{ color: '#a8a8a0', marginTop: '0.5rem' }}>
                🔎 Analyzing evidence for classified information
              </p>
            </div>
          )}

          {results && !loading && (
            <section className="results-section">
              <div className="stamp">
                <div className={getStampClass(results.riskLevel)}>
                  {results.riskLevel === 'LOW' ? '✓ CLEARED' : '🚨 SECURITY BREACH'}
                </div>
              </div>

              <div className="risk-score">
                <div className="risk-gauge" style={{ color: getRiskColor(results.riskLevel) }}>
                  {results.riskScore}/100
                </div>
                <div className="risk-label" style={{ color: getRiskColor(results.riskLevel) }}>
                  Threat Assessment: {results.riskLevel}
                </div>
                
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e63946' }}>
                      {results.regexScore || 0}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#a8a8a0' }}>Pattern Score</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4fd1c5' }}>
                      {results.aiScore || 0}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#a8a8a0' }}>AI Analysis</div>
                  </div>
                </div>
              </div>

              {regexFindings.length > 0 && (
                <div className="findings regex-findings">
                  <h3 className="section-title">
                    <AlertTriangle size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                    🔍 Evidence Collected ({regexFindings.length})
                  </h3>
                  
                  <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                    <h4 style={{ marginBottom: '1rem' }}>📝 Select Data Types for Redaction</h4>
                    <p style={{ color: '#a8a8a0', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Choose which classified information to redact from the document
                    </p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                      {Array.from(new Set(regexFindings.map(f => f.type))).map(type => {
                        const count = regexFindings.filter(f => f.type === type).length;
                        const isSelected = selectedTypes.has(type);
                        return (
                          <label 
                            key={type}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.75rem 1rem',
                              background: isSelected ? 'rgba(205,164,94,0.2)' : 'rgba(0,0,0,0.3)',
                              border: `2px solid ${isSelected ? '#cda45e' : '#2a2a2a'}`,
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleType(type)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                              {type.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span style={{ 
                              background: '#2a2a2a', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '12px',
                              fontSize: '0.8rem'
                            }}>
                              {count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <button 
                        className="upload-btn" 
                        onClick={() => setSelectedTypes(new Set(regexFindings.map(f => f.type)))}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Select All
                      </button>
                      <button 
                        className="upload-btn" 
                        onClick={() => setSelectedTypes(new Set())}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#2a2a2a' }}
                      >
                        Deselect All
                      </button>
                    </div>

                    <h4 style={{ marginBottom: '1rem' }}>🖊️ Redaction Method</h4>
                    <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                      <label>
                        <input type="radio" value="full" checked={redactionStyle === 'full'} onChange={(e) => setRedactionStyle(e.target.value)} />
                        {' '}[REDACTED]
                      </label>
                      <label>
                        <input type="radio" value="partial" checked={redactionStyle === 'partial'} onChange={(e) => setRedactionStyle(e.target.value)} />
                        {' '}Partial (xxx***xxx)
                      </label>
                      <label>
                        <input type="radio" value="asterisk" checked={redactionStyle === 'asterisk'} onChange={(e) => setRedactionStyle(e.target.value)} />
                        {' '}Asterisks (***)
                      </label>
                      <label>
                        <input type="radio" value="block" checked={redactionStyle === 'block'} onChange={(e) => setRedactionStyle(e.target.value)} />
                        {' '}Black Bars (███)
                      </label>
                    </div>
                    
                    <button 
                      className="upload-btn" 
                      onClick={handleRedact} 
                      disabled={selectedTypes.size === 0}
                    >
                      <Eye size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                      Preview Redacted ({getSelectedFindings().length} items)
                    </button>
                  </div>

                  <h4 style={{ marginBottom: '1rem', marginTop: '2rem' }}>📂 All Evidence Items</h4>
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

              {(aiSummary || aiFindings.length > 0) && (
                <div className="findings ai-findings">
                  <h3 className="section-title ai-title">
                    🧠 Detective's Analysis Report
                  </h3>
                  {aiSummary && (
                    <div className="ai-report">
                      <strong>Case Summary:</strong> {aiSummary}
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

              {regexFindings.length === 0 && !aiSummary && aiFindings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <CheckCircle size={64} style={{ color: '#4fd1c5', margin: '0 auto 1rem' }} />
                  <h3 style={{ color: '#4fd1c5' }}>✓ Case Closed - No Threats Detected</h3>
                  <p style={{ color: '#a8a8a0', marginTop: '0.5rem' }}>
                    Document cleared for distribution
                  </p>
                </div>
              )}

              {showPreview && (
                <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>📄 Redacted Document Preview</h3>
                    <button className="upload-btn" onClick={handleDownload} style={{ padding: '0.5rem 1rem' }}>
                      <Download size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                      Download Redacted File
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <h4 style={{ color: '#a8a8a0', marginBottom: '0.5rem' }}>Original Evidence</h4>
                      <pre style={{ background: '#0a0a0a', padding: '1rem', borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap', border: '1px solid #2a2a2a' }}>
                        {highlightRedactions(fileText) || "Preview unavailable"}
                      </pre>
                    </div>
                    <div>
                      <h4 style={{ color: '#a8a8a0', marginBottom: '0.5rem' }}>Redacted Version</h4>
                      <pre style={{ background: '#0a0a0a', padding: '1rem', borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap', border: '1px solid #2a2a2a' }}>
                        {redactedText}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      ) : activeTab === 'dashboard' ? (
        <Dashboard />
      ) : (
        <History onViewScan={handleViewScan} />
      )}
    </div>
  );
}

export default App;