import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api.client';
import './NetworkPage.css';

interface AlumniUser {
  id: string;
  full_name: string;
  email: string;
  branch?: string;
  graduation_year?: number;
  company_name?: string;
  designation?: string;
  profile_picture_url?: string;
  current_city?: string;
  years_of_experience?: number;
  is_connected?: boolean;
}

const NetworkPage: React.FC = () => {
  const [alumni, setAlumni] = useState<AlumniUser[]>([]);
  const [filteredAlumni, setFilteredAlumni] = useState<AlumniUser[]>([]);
  const [connections, setConnections] = useState<AlumniUser[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'connections' | 'requests'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mentors' | 'connected'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [spotlightUser, setSpotlightUser] = useState<AlumniUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'discover') {
      setFilterType('all');
      setCityFilter('');
      setSearchQuery('');
    }
  }, [activeTab]);

  useEffect(() => {
    // Apply filters whenever search or filter changes
    filterAlumni();
  }, [alumni, searchQuery, filterType, cityFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'discover') {
        const response = await apiClient.searchUsers('', 1, 200);
        if (response.error) {
          console.error('Failed to fetch alumni:', response.error);
          setAlumni([]);
          setFilteredAlumni([]);
          return;
        }
        if (response.data) {
          const data = response.data as any;
          const alumniList = Array.isArray(data)
            ? data
            : (Array.isArray(data.users)
                ? data.users
                : (Array.isArray(data.data?.users) ? data.data.users : []));
          setAlumni(alumniList);
          setFilteredAlumni(alumniList);
          
          // Extract unique cities
          const cities = Array.from(
            new Set(
              alumniList
                .filter((u: any) => u.current_city)
                .map((u: any) => u.current_city)
            )
          ).sort() as string[];
          setAvailableCities(cities);
        }
      } else if (activeTab === 'connections') {
        const response = await apiClient.searchUsers('', 1, 200);
        if (response.error) {
          console.error('Failed to fetch connections:', response.error);
          setConnections([]);
          return;
        }
        if (response.data) {
          const data = response.data as any;
          const allUsers = Array.isArray(data)
            ? data
            : (Array.isArray(data.users)
                ? data.users
                : (Array.isArray(data.data?.users) ? data.data.users : []));
          setConnections(allUsers.filter((u: AlumniUser) => u.is_connected));
        }
      } else if (activeTab === 'requests') {
        // Current backend does not expose pending request routes; keep tab graceful.
        setRequests([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAlumni = () => {
    let filtered = alumni;

    // Filter by type
    if (filterType === 'mentors') {
      filtered = filtered.filter((a) => 
        a.years_of_experience && a.years_of_experience > 5
      );
    } else if (filterType === 'connected') {
      filtered = filtered.filter((a) => a.is_connected);
    }

    // Filter by city
    if (cityFilter) {
      filtered = filtered.filter((a) => a.current_city === cityFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) =>
        (a.full_name && a.full_name.toLowerCase().includes(query)) ||
        (a.company_name && a.company_name.toLowerCase().includes(query)) ||
        (a.designation && a.designation.toLowerCase().includes(query)) ||
        (a.current_city && a.current_city.toLowerCase().includes(query))
      );
    }

    setFilteredAlumni(filtered);
  };

  const handleConnect = async (userId: string) => {
    try {
      await apiClient.sendConnectionRequest(userId);
      alert('Connection request sent!');
      fetchData();
    } catch (error) {
      console.error('Failed to send connection request:', error);
      alert('Failed to send connection request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await apiClient.acceptConnectionRequest(requestId);
      alert('Connection request accepted!');
      fetchData();
    } catch (error) {
      console.error('Failed to accept request:', error);
      alert('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await apiClient.rejectConnectionRequest(requestId);
      alert('Connection request rejected');
      fetchData();
    } catch (error) {
      console.error('Failed to reject request:', error);
      alert('Failed to reject request');
    }
  };

  const getMatchScore = (user: AlumniUser) => {
    const experiencePoints = Math.min((user.years_of_experience || 0) * 4, 40);
    const profileDepth = [user.company_name, user.designation, user.current_city, user.branch].filter(Boolean).length * 15;
    const connectionBoost = user.is_connected ? 15 : 0;
    return Math.min(95, 30 + experiencePoints + profileDepth + connectionBoost);
  };

  const discoverCount = filteredAlumni.length;
  const connectionCount = connections.length;
  const requestCount = requests.length;

  return (
    <div className="network-page">
      <div className="network-hero">
        <div>
          <h1 className="page-title">Network</h1>
          <p className="network-subtitle">Find alumni with strong profile match and build meaningful circles.</p>
        </div>
        <div className="network-hero-stats">
          <div className="hero-stat-card">
            <span>Discover</span>
            <strong>{discoverCount}</strong>
          </div>
          <div className="hero-stat-card">
            <span>Connected</span>
            <strong>{connectionCount}</strong>
          </div>
          <div className="hero-stat-card">
            <span>Requests</span>
            <strong>{requestCount}</strong>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'discover' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover Alumni
        </button>
        <button
          className={`tab ${activeTab === 'connections' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('connections')}
        >
          My Connections
        </button>
        <button
          className={`tab ${activeTab === 'requests' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests ({requests.length})
        </button>
      </div>

      {isLoading ? (
        <div className="loading-spinner"></div>
      ) : (
        <>
          {activeTab === 'discover' && (
            <>
              <div className="search-filters">
                <input
                  type="text"
                  placeholder="Search by name, company, title, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                
                <div className="filter-controls">
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="filter-select"
                  >
                    <option value="all">All Users</option>
                    <option value="mentors">Mentors (5+ years)</option>
                    <option value="connected">Connected</option>
                  </select>

                  {availableCities.length > 0 && (
                    <select 
                      value={cityFilter} 
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Cities</option>
                      {availableCities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="filter-results">
                Found {filteredAlumni.length} alumni
              </div>

              <div className="alumni-grid">
                {filteredAlumni.length === 0 ? (
                  <div className="empty-state">No alumni found matching your filters</div>
              ) : (
                filteredAlumni.map((user) => (
                  <div key={user.id} className="alumni-card">
                    <div className="alumni-match-score">{getMatchScore(user)}% match</div>
                    <div className="alumni-avatar">
                      {user.profile_picture_url ? (
                        <img src={apiClient.getPublicFileUrl(user.profile_picture_url)} alt={user.full_name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h3 className="alumni-name">{user.full_name}</h3>
                    {user.designation && (
                      <p className="alumni-title">{user.designation}</p>
                    )}
                    {user.company_name && (
                      <p className="alumni-company">{user.company_name}</p>
                    )}
                    {user.branch && (
                      <p className="alumni-info">
                        {user.branch} • {user.graduation_year}
                      </p>
                    )}
                    <div className="alumni-badges">
                      {user.years_of_experience && user.years_of_experience > 5 && (
                        <span className="alumni-badge mentor">Mentor</span>
                      )}
                      {user.current_city && <span className="alumni-badge city">{user.current_city}</span>}
                      {user.is_connected && <span className="alumni-badge connected">Connected</span>}
                    </div>
                    <div className="alumni-actions">
                      {user.is_connected ? (
                        <button
                          className="button button-primary"
                          onClick={() => navigate(`/messages?user=${user.id}`)}
                        >
                          Message
                        </button>
                      ) : (
                        <button
                          className="button button-primary"
                          onClick={() => handleConnect(user.id)}
                        >
                          Connect
                        </button>
                      )}
                      <button
                        className="button button-secondary"
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        View Profile
                      </button>
                      <button
                        className="button button-secondary spotlight-trigger"
                        onClick={() => setSpotlightUser(user)}
                      >
                        Spotlight
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            </>
          )}

          {activeTab === 'connections' && (
            <div className="alumni-grid">
              {connections.length === 0 ? (
                <div className="empty-state">No connections yet</div>
              ) : (
                connections.map((user) => (
                  <div key={user.id} className="alumni-card">
                    <div className="alumni-match-score">{getMatchScore(user)}% match</div>
                    <div className="alumni-avatar">
                      {user.profile_picture_url ? (
                        <img src={apiClient.getPublicFileUrl(user.profile_picture_url)} alt={user.full_name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h3 className="alumni-name">{user.full_name}</h3>
                    {user.designation && (
                      <p className="alumni-title">{user.designation}</p>
                    )}
                    {user.company_name && (
                      <p className="alumni-company">{user.company_name}</p>
                    )}
                    <div className="alumni-badges">
                      <span className="alumni-badge connected">Connected</span>
                      {user.current_city && <span className="alumni-badge city">{user.current_city}</span>}
                    </div>
                    <div className="alumni-actions">
                      <button
                        className="button button-primary"
                        onClick={() => navigate(`/messages?user=${user.id}`)}
                      >
                        Message
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        View Profile
                      </button>
                      <button
                        className="button button-secondary spotlight-trigger"
                        onClick={() => setSpotlightUser(user)}
                      >
                        Spotlight
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="requests-list">
              {requests.length === 0 ? (
                <div className="empty-state">No pending requests</div>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="request-card">
                    <div className="request-info">
                      <div className="alumni-avatar">
                        {request.sender_picture ? (
                          <img src={request.sender_picture} alt={request.sender_name} />
                        ) : (
                          <div className="avatar-placeholder">
                            {request.sender_name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3>{request.sender_name}</h3>
                        <p className="request-date">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="request-actions">
                      <button
                        className="button button-primary"
                        onClick={() => handleAcceptRequest(request.id)}
                      >
                        Accept
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {spotlightUser && (
        <div className="network-spotlight-overlay" onClick={() => setSpotlightUser(null)}>
          <div className="network-spotlight-modal" onClick={(e) => e.stopPropagation()}>
            <button className="network-spotlight-close" onClick={() => setSpotlightUser(null)}>
              ✕
            </button>
            <div className="network-spotlight-header">
              <div className="alumni-avatar large">
                {spotlightUser.profile_picture_url ? (
                  <img src={apiClient.getPublicFileUrl(spotlightUser.profile_picture_url)} alt={spotlightUser.full_name} />
                ) : (
                  <div className="avatar-placeholder large">
                    {spotlightUser.full_name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="network-spotlight-title-group">
                <span className="spotlight-kicker">Network Spotlight</span>
                <h2>{spotlightUser.full_name}</h2>
                <p>
                  {spotlightUser.designation || 'Alumni Member'}
                  {spotlightUser.company_name ? ` at ${spotlightUser.company_name}` : ''}
                </p>
              </div>
              <div className="spotlight-score-badge">{getMatchScore(spotlightUser)}%</div>
            </div>

            <div className="network-spotlight-grid">
              <div className="spotlight-card">
                <span>City</span>
                <strong>{spotlightUser.current_city || 'Not shared'}</strong>
              </div>
              <div className="spotlight-card">
                <span>Branch</span>
                <strong>{spotlightUser.branch || 'Not shared'}</strong>
              </div>
              <div className="spotlight-card">
                <span>Graduation</span>
                <strong>{spotlightUser.graduation_year || 'Not shared'}</strong>
              </div>
              <div className="spotlight-card">
                <span>Experience</span>
                <strong>{spotlightUser.years_of_experience ? `${spotlightUser.years_of_experience} years` : 'Not shared'}</strong>
              </div>
            </div>

            <div className="network-spotlight-actions">
              {spotlightUser.is_connected ? (
                <button
                  className="button button-primary"
                  onClick={() => navigate(`/messages?user=${spotlightUser.id}`)}
                >
                  Message
                </button>
              ) : (
                <button
                  className="button button-primary"
                  onClick={() => {
                    handleConnect(spotlightUser.id);
                    setSpotlightUser(null);
                  }}
                >
                  Connect
                </button>
              )}
              <button
                className="button button-secondary"
                onClick={() => navigate(`/profile/${spotlightUser.id}`)}
              >
                Open Full Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkPage;
