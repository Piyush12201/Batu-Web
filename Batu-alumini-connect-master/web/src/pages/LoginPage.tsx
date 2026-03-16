import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginUser, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isAdmin) {
        await loginAdmin(email, password);
        navigate('/admin');
      } else {
        await loginUser(email, password);
        navigate('/feed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
      </div>

      <div className="auth-container">
        <Link to="/" className="auth-back-link">← Back to Home</Link>

        <div className="auth-card">
          <div className="auth-icon">👋</div>
          <h1 className="auth-title">Welcome Back!</h1>
          <p className="auth-subtitle">Login to your Alumni Connect account</p>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-toggle">
            <label className="toggle-label">
              <input
                type="radio"
                name="auth-type"
                value="user"
                checked={!isAdmin}
                onChange={() => setIsAdmin(false)}
                disabled={isLoading}
              />
              <span>User Login</span>
            </label>
            <label className="toggle-label">
              <input
                type="radio"
                name="auth-type"
                value="admin"
                checked={isAdmin}
                onChange={() => setIsAdmin(true)}
                disabled={isLoading}
              />
              <span>Admin Login</span>
            </label>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link">Register here</Link>
            </p>
          </div>

          <div className="auth-demo-info">
            <p className="auth-demo-title">Demo Credentials:</p>
            <p className="auth-demo-text">User: demo@batu.edu / demo123</p>
            <p className="auth-demo-text">Admin: admin@batu-alumni.com / Admin@123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
