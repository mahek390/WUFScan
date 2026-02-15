import React, { useState } from 'react';
import { Shield, LogIn } from 'lucide-react';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      // Check if user with same name exists in localStorage
      const existingUsers = JSON.parse(localStorage.getItem('wufscan_users') || '{}');
      const normalizedUsername = username.trim().toLowerCase();
      
      let userData;
      if (existingUsers[normalizedUsername]) {
        // Reuse existing user session
        userData = existingUsers[normalizedUsername];
        console.log('Returning detective:', userData.username);
      } else {
        // Create new user
        userData = {
          username: username.trim(),
          userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        existingUsers[normalizedUsername] = userData;
        localStorage.setItem('wufscan_users', JSON.stringify(existingUsers));
        console.log('New detective registered:', userData.username);
      }
      
      onLogin(userData);
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
          <p>🔒 Returning detectives: Enter your name to resume</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
