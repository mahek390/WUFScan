import React, { useState } from 'react';
import { Shield, LogIn } from 'lucide-react';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      onLogin({ username: username.trim(), userId });
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <Shield size={64} />
          <h1>WufScan Bureau</h1>
          <p>Detective Division Access</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Detective Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              required
              autoFocus
            />
          </div>

          <button type="submit" className="login-btn">
            <LogIn size={20} />
            {isRegistering ? 'Join Bureau' : 'Enter Bureau'}
          </button>
        </form>

        <div className="login-footer">
          <p>🔒 All investigations are tracked per detective</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
