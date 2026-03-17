import React from 'react';
import { Link } from 'react-router-dom';
import batuLogo from '../../assets/batu_logo-removebg-preview.png';
import './HomePage.css';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="home-background">
        <div className="home-orb home-orb-1"></div>
        <div className="home-orb home-orb-2"></div>
      </div>
      
      <div className="home-content">
        <header className="home-header">
          <div className="home-header-brand">
            <img src={batuLogo} alt="BATU" className="home-header-logo-img" />
            <span className="home-header-logo-text">Alumni Connect</span>
          </div>
        </header>

        <main className="home-main">
          <div className="home-hero">
            <img src={batuLogo} alt="BATU Alumni Connect" className="home-hero-logo" />
            <div className="home-hero-kicker">BATU Professional Network</div>
            <h2 className="home-hero-title">Welcome to BATU Alumni Connect</h2>
            <p className="home-hero-description">
              Connect with fellow alumni, explore career opportunities, and stay engaged with the BATU community
            </p>
            
            <div className="home-hero-actions">
              <Link to="/login" className="home-button home-button-primary">
                Login
              </Link>
              <Link to="/register" className="home-button home-button-secondary">
                Register
              </Link>
            </div>
          </div>

          <div className="home-features">
            <div className="home-feature-card">
              <div className="home-feature-icon">FD</div>
              <h3>Alumni Feed</h3>
              <p>Share updates, achievements, and connect with the community</p>
            </div>
            <div className="home-feature-card">
              <div className="home-feature-icon">NW</div>
              <h3>Network</h3>
              <p>Connect with alumni from your batch and across batches</p>
            </div>
            <div className="home-feature-card">
              <div className="home-feature-icon">OP</div>
              <h3>Opportunities</h3>
              <p>Discover jobs, internships, and mentorship opportunities</p>
            </div>
            <div className="home-feature-card">
              <div className="home-feature-icon">CH</div>
              <h3>Messages</h3>
              <p>Direct messaging with real-time communication</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;
