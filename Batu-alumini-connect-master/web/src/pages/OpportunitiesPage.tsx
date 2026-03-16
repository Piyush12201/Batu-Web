import React, { useState, useEffect } from 'react';
import apiClient from '../services/api.client';
import './OpportunitiesPage.css';

interface Opportunity {
  id: string;
  title: string;
  description: string;
  type: string;
  company_name?: string;
  location?: string;
  posted_by_name: string;
  created_at: string;
  is_applied?: boolean;
}

const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [applyingOpportunityId, setApplyingOpportunityId] = useState<string | null>(null);
  const [spotlightOpportunity, setSpotlightOpportunity] = useState<Opportunity | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'job',
    company: '',
    location: '',
  });

  useEffect(() => {
    fetchOpportunities();
  }, [filter]);

  const fetchOpportunities = async () => {
    try {
      const response = await apiClient.getOpportunities({
        type: filter === 'all' ? undefined : filter,
        page: 1,
        limit: 20,
      });
      if (response.data) {
        if (Array.isArray(response.data)) {
          setOpportunities(response.data);
        } else {
          const data = response.data as any;
          setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
      setOpportunities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.createOpportunity({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        company_name: formData.company,
        location: formData.location,
      });
      if (response.data) {
        alert('Opportunity posted successfully!');
        setShowCreateForm(false);
        setFormData({ title: '', description: '', type: 'job', company: '', location: '' });
        fetchOpportunities();
      }
    } catch (error) {
      console.error('Failed to create opportunity:', error);
      alert('Failed to post opportunity');
    }
  };

  const handleApply = async (opportunityId: string) => {
    try {
      setApplyingOpportunityId(opportunityId);
      const response = await apiClient.applyToOpportunity(opportunityId, {});

      if (response.error) {
        alert(response.error);
        return;
      }

      alert('Applied successfully. A message was sent to the poster.');
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === opportunityId ? { ...opp, is_applied: true } : opp
        )
      );
    } catch (error) {
      console.error('Failed to apply to opportunity:', error);
      alert('Failed to apply for this opportunity');
    } finally {
      setApplyingOpportunityId(null);
    }
  };

  const getTypeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

  const getFreshness = (createdAt: string) => {
    const now = new Date().getTime();
    const posted = new Date(createdAt).getTime();
    const diffHours = Math.max(1, Math.floor((now - posted) / (1000 * 60 * 60)));

    if (diffHours <= 24) return `New · ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Posted · ${diffDays}d ago`;
  };

  const totalApplied = opportunities.filter((opp) => opp.is_applied).length;

  return (
    <div className="opportunities-page">
      <div className="opportunities-hero">
        <div>
          <h1 className="page-title">Opportunities</h1>
          <p className="opportunities-subtitle">Launch jobs, internships, and collaborations through one high-signal board.</p>
        </div>
        <div className="opportunities-hero-stats">
          <div className="opportunity-stat-card">
            <span>Available</span>
            <strong>{opportunities.length}</strong>
          </div>
          <div className="opportunity-stat-card">
            <span>Applied</span>
            <strong>{totalApplied}</strong>
          </div>
          <button
            className="button button-primary post-opp-button"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Close Form' : '+ Post Opportunity'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="create-opportunity-card">
          <h2>Opportunity Launch Pad</h2>
          <form onSubmit={handleSubmit} className="opportunity-form">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Type *</label>
              <select
                className="form-input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              >
                <option value="job">Job</option>
                <option value="internship">Internship</option>
                <option value="mentorship">Mentorship</option>
                <option value="collaboration">Collaboration</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                className="form-textarea"
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="button button-primary">
              Post Opportunity
            </button>
          </form>
        </div>
      )}

      <div className="filter-buttons">
        {['all', 'job', 'internship', 'mentorship', 'collaboration'].map((type) => (
          <button
            key={type}
            className={`filter-button ${filter === type ? 'active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading-spinner"></div>
      ) : opportunities.length === 0 ? (
        <div className="empty-state">No opportunities available</div>
      ) : (
        <div className="opportunities-list">
          {opportunities.map((opp) => (
            <div key={opp.id} className="opportunity-card">
              <div className="opportunity-card-top">
                <div className={`opportunity-badge ${opp.type}`}>
                  {opp.type}
                </div>
                <div className="opportunity-freshness">{getFreshness(opp.created_at)}</div>
              </div>
              <h3>{opp.title}</h3>
              {opp.company_name && <p className="opportunity-company">📍 {opp.company_name}</p>}
              {opp.location && <p className="opportunity-location">🌍 {opp.location}</p>}
              <p className="opportunity-description">{opp.description}</p>
              <div className="opportunity-meta-chips">
                <span className="opportunity-chip">{getTypeLabel(opp.type)}</span>
                {opp.location && <span className="opportunity-chip">{opp.location}</span>}
                {opp.company_name && <span className="opportunity-chip">{opp.company_name}</span>}
              </div>
              <div className="opportunity-footer">
                <span className="opportunity-posted-by">Posted by {opp.posted_by_name}</span>
                <span className="opportunity-date">
                  {new Date(opp.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="opportunity-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setSpotlightOpportunity(opp)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="button button-primary apply-button"
                  onClick={() => handleApply(opp.id)}
                  disabled={Boolean(opp.is_applied) || applyingOpportunityId === opp.id}
                >
                  {opp.is_applied
                    ? 'Applied'
                    : applyingOpportunityId === opp.id
                      ? 'Applying...'
                      : 'Apply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {spotlightOpportunity && (
        <div className="opportunity-spotlight-overlay" onClick={() => setSpotlightOpportunity(null)}>
          <div className="opportunity-spotlight-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="opportunity-spotlight-close"
              type="button"
              onClick={() => setSpotlightOpportunity(null)}
            >
              ✕
            </button>

            <div className="opportunity-spotlight-header">
              <div>
                <div className={`opportunity-badge ${spotlightOpportunity.type}`}>
                  {spotlightOpportunity.type}
                </div>
                <h2>{spotlightOpportunity.title}</h2>
                <p>{getFreshness(spotlightOpportunity.created_at)}</p>
              </div>
              <div className="spotlight-type-pill">{getTypeLabel(spotlightOpportunity.type)}</div>
            </div>

            <div className="opportunity-spotlight-grid">
              <div className="spotlight-meta-card">
                <span>Company</span>
                <strong>{spotlightOpportunity.company_name || 'Not specified'}</strong>
              </div>
              <div className="spotlight-meta-card">
                <span>Location</span>
                <strong>{spotlightOpportunity.location || 'Remote / Flexible'}</strong>
              </div>
              <div className="spotlight-meta-card wide">
                <span>Posted By</span>
                <strong>{spotlightOpportunity.posted_by_name}</strong>
              </div>
            </div>

            <p className="opportunity-spotlight-description">{spotlightOpportunity.description}</p>

            <div className="opportunity-spotlight-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  handleApply(spotlightOpportunity.id);
                  setSpotlightOpportunity(null);
                }}
                disabled={Boolean(spotlightOpportunity.is_applied) || applyingOpportunityId === spotlightOpportunity.id}
              >
                {spotlightOpportunity.is_applied
                  ? 'Already Applied'
                  : applyingOpportunityId === spotlightOpportunity.id
                    ? 'Applying...'
                    : 'Apply Now'}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSpotlightOpportunity(null)}
              >
                Keep Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesPage;
