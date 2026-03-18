import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api.client';
import batuLogo from '../../assets/batu_logo-removebg-preview.png';
import './AdminPage.css';

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface FilterOptions {
  branches: string[];
  sectors: string[];
  jobTypes: string[];
  companies: string[];
  cities: string[];
  statuses: string[];
}

interface Filters {
  branch: string[];
  sector: string[];
  jobType: string[];
  company: string[];
  city: string[];
  status: string[];
  graduationYearFrom: string;
  graduationYearTo: string;
  experienceMin: string;
  experienceMax: string;
}

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  mobile_number?: string;
  branch: string;
  graduation_year?: number;
  city?: string;
  linkedin_url?: string;
  company_name?: string;
  designation?: string;
  job_type?: string;
  job_sector?: string;
  id_proof_url?: string;
  created_at: string;
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [broadcast, setBroadcast] = useState({ title: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pending' | 'approved' | 'reports' | 'broadcast'>('dashboard');
  
  // Reports filters state
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<Filters>({
    branch: [],
    sector: [],
    jobType: [],
    company: [],
    city: [],
    status: [],
    graduationYearFrom: '',
    graduationYearTo: '',
    experienceMin: '',
    experienceMax: ''
  });
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    branch: true,
    sector: true,
    jobType: true,
    company: false,
    city: false,
    status: true,
    years: false,
    experience: false
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    fetchData();
    if (activeTab === 'reports' && !filterOptions) {
      fetchFilterOptions();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const statsRes = await apiClient.getAdminStats();
      if (statsRes.data && statsRes.data.stats) {
        setStats(statsRes.data.stats);
      } else if (statsRes.data) {
        // Handle direct stats format
        setStats({
          pending: statsRes.data.pending || 0,
          approved: statsRes.data.approved || 0,
          rejected: statsRes.data.rejected || 0,
          total: statsRes.data.total || 0
        });
      }

      if (activeTab === 'pending') {
        const pendingRes = await apiClient.getPendingUsers();
        if (pendingRes.data) {
          setPendingUsers(pendingRes.data.users || pendingRes.data);
        }
      }

      if (activeTab === 'approved') {
        const approvedRes = await apiClient.getApprovedUsers();
        if (approvedRes.data) {
          setApprovedUsers(approvedRes.data.users || approvedRes.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      console.log('📊 Fetching report filter options...');
      const response = await apiClient.getReportFilters();
      if (response.data) {
        setFilterOptions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const handleViewUserDetails = (user: PendingUser) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleApproveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to approve this user?')) return;

    try {
      await apiClient.approveUser(userId, remarks);
      alert('User approved successfully!');
      setShowModal(false);
      setRemarks('');
      fetchData();
    } catch (error) {
      console.error('Failed to approve user:', error);
      alert('Failed to approve user');
    }
  };

  const handleRejectUser = async (userId: string) => {
    const rejectRemarks = prompt('Please provide a reason for rejection (optional):');
    if (rejectRemarks === null) return;

    try {
      await apiClient.rejectUser(userId, rejectRemarks);
      alert('User rejected');
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to reject user:', error);
      alert('Failed to reject user');
    }
  };

  const handleRevokeUser = async (userId: string) => {
    const revokeRemarks = prompt('Please provide a reason for revoking access (optional):');
    if (revokeRemarks === null) return;

    if (!confirm('Are you sure you want to revoke this user? This will remove approved access.')) {
      return;
    }

    try {
      await apiClient.rejectUser(userId, revokeRemarks || 'Access revoked by admin');
      alert('User access revoked successfully');
      fetchData();
    } catch (error) {
      console.error('Failed to revoke user:', error);
      alert('Failed to revoke user');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcast.title || !broadcast.message) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await apiClient.sendBroadcast(broadcast.title, broadcast.message);
      alert('Broadcast sent successfully!');
      setBroadcast({ title: '', message: '' });
    } catch (error) {
      console.error('Failed to send broadcast:', error);
      alert('Failed to send broadcast');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/admin/profile/${userId}`);
  };

  const toggleFilterSelection = (filterType: string, value: string) => {
    setSelectedFilters(prev => {
      const currentValues = prev[filterType as keyof Filters] as string[];
      const isSelected = currentValues.includes(value);
      return {
        ...prev,
        [filterType]: isSelected
          ? currentValues.filter(v => v !== value)
          : [...currentValues, value]
      };
    });
  };

  const selectAllInCategory = (filterType: string, values: string[]) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: values
    }));
  };

  const clearCategory = (filterType: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: []
    }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedFilters.branch.length > 0) count++;
    if (selectedFilters.sector.length > 0) count++;
    if (selectedFilters.jobType.length > 0) count++;
    if (selectedFilters.company.length > 0) count++;
    if (selectedFilters.city.length > 0) count++;
    if (selectedFilters.status.length > 0) count++;
    if (selectedFilters.graduationYearFrom || selectedFilters.graduationYearTo) count++;
    if (selectedFilters.experienceMin || selectedFilters.experienceMax) count++;
    return count;
  };

  const applyQuickFilter = (filterName: string) => {
    const currentYear = new Date().getFullYear();
    switch(filterName) {
      case 'government':
        setSelectedFilters({
          ...selectedFilters,
          sector: ['Government'],
          status: ['approved']
        });
        break;
      case 'recent':
        setSelectedFilters({
          ...selectedFilters,
          graduationYearFrom: (currentYear - 3).toString(),
          graduationYearTo: currentYear.toString(),
          status: ['approved']
        });
        break;
      case 'experienced':
        setSelectedFilters({
          ...selectedFilters,
          experienceMin: '10',
          status: ['approved']
        });
        break;
      case 'all':
        clearAllFilters();
        break;
    }
  };

  const clearAllFilters = () => {
    setSelectedFilters({
      branch: [],
      sector: [],
      jobType: [],
      company: [],
      city: [],
      status: [],
      graduationYearFrom: '',
      graduationYearTo: '',
      experienceMin: '',
      experienceMax: ''
    });
  };

  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);
      console.log('📊 Generating report with filters:', selectedFilters);

      const filters: any = {};
      if (selectedFilters.branch.length > 0) filters.branch = selectedFilters.branch;
      if (selectedFilters.sector.length > 0) filters.sector = selectedFilters.sector;
      if (selectedFilters.jobType.length > 0) filters.jobType = selectedFilters.jobType;
      if (selectedFilters.company.length > 0) filters.company = selectedFilters.company;
      if (selectedFilters.city.length > 0) filters.city = selectedFilters.city;
      if (selectedFilters.status.length > 0) filters.status = selectedFilters.status;
      
      if (selectedFilters.graduationYearFrom) {
        filters.graduationYearFrom = parseInt(selectedFilters.graduationYearFrom);
      }
      if (selectedFilters.graduationYearTo) {
        filters.graduationYearTo = parseInt(selectedFilters.graduationYearTo);
      }
      if (selectedFilters.experienceMin) {
        filters.experienceMin = parseInt(selectedFilters.experienceMin);
      }
      if (selectedFilters.experienceMax) {
        filters.experienceMax = parseInt(selectedFilters.experienceMax);
      }

      const response = await apiClient.generateReport(filters);
      
      if (response.data) {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `alumni_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        alert('Report downloaded successfully!');
      } else {
        alert('Failed to generate report');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const tabMeta: Record<typeof activeTab, { title: string; description: string }> = {
    dashboard: {
      title: 'Overview Command Center',
      description: 'Track approvals, rejections, and total network health in one place.',
    },
    pending: {
      title: 'Verification Queue',
      description: 'Review and decide pending registrations with fast moderation actions.',
    },
    approved: {
      title: 'Approved Alumni Directory',
      description: 'Monitor active members and manage profile-level admin actions.',
    },
    reports: {
      title: 'Reporting Studio',
      description: 'Compose filter sets and export focused alumni intelligence reports.',
    },
    broadcast: {
      title: 'Broadcast Mission Control',
      description: 'Send clear platform-wide announcements to approved alumni members.',
    },
  };

  if (isLoading && activeTab === 'dashboard') {
    return (
      <div className="page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Modern Admin Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-branding">
            <img src={batuLogo} alt="BATU" className="admin-logo" />
            <div className="admin-title-section">
              <h1 className="admin-title">Admin Dashboard</h1>
              <p className="admin-subtitle">Manage your alumni network</p>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <span>Logout</span>
            <svg className="logout-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="admin-nav">
        <div className="admin-nav-content">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'pending' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Pending</span>
            {stats.pending > 0 && (
              <span className="nav-badge">{stats.pending}</span>
            )}
          </button>
          <button
            className={`nav-tab ${activeTab === 'approved' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Approved</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'reports' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Reports</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'broadcast' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('broadcast')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <span>Broadcast</span>
          </button>
        </div>
      </nav>

      <section className="admin-command-bar">
        <div className="command-bar-main">
          <span className="command-bar-kicker">Admin Focus</span>
          <h3>{tabMeta[activeTab].title}</h3>
          <p>{tabMeta[activeTab].description}</p>
        </div>
        <div className="command-bar-metrics">
          <div className="command-metric pending">
            <span>Pending</span>
            <strong>{stats.pending || 0}</strong>
          </div>
          <div className="command-metric approved">
            <span>Approved</span>
            <strong>{stats.approved || 0}</strong>
          </div>
          <div className="command-metric total">
            <span>Total</span>
            <strong>{stats.total || 0}</strong>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="admin-main">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            <div className="section-header">
              <h2 className="section-title">Overview Statistics</h2>
              <p className="section-subtitle">Real-time analytics of your alumni network</p>
            </div>
            
            <div className="stats-grid">
              <div className="modern-stat-card card-pending">
                <div className="stat-card-header">
                  <div className="stat-icon-wrapper pending-icon">
                    <svg className="stat-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="stat-trend">↑</span>
                </div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.pending || 0}</h3>
                  <p className="stat-title">Pending Approval</p>
                  <p className="stat-description">Awaiting review</p>
                </div>
              </div>

              <div className="modern-stat-card card-approved">
                <div className="stat-card-header">
                  <div className="stat-icon-wrapper approved-icon">
                    <svg className="stat-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="stat-trend success">✓</span>
                </div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.approved || 0}</h3>
                  <p className="stat-title">Approved Users</p>
                  <p className="stat-description">Active members</p>
                </div>
              </div>

              <div className="modern-stat-card card-rejected">
                <div className="stat-card-header">
                  <div className="stat-icon-wrapper rejected-icon">
                    <svg className="stat-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="stat-trend decline">↓</span>
                </div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.rejected || 0}</h3>
                  <p className="stat-title">Rejected</p>
                  <p className="stat-description">Declined applications</p>
                </div>
              </div>

              <div className="modern-stat-card card-total">
                <div className="stat-card-header">
                  <div className="stat-icon-wrapper total-icon">
                    <svg className="stat-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="stat-trend">∑</span>
                </div>
                <div className="stat-content">
                  <h3 className="stat-number">{stats.total || 0}</h3>
                  <p className="stat-title">Total Users</p>
                  <p className="stat-description">All registrations</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Users Tab */}
        {activeTab === 'pending' && (
          <div className="content-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Pending User Approvals</h2>
                <p className="section-subtitle">{pendingUsers.length} applications awaiting review</p>
              </div>
            </div>
            
            {isLoading ? (
              <div className="loading-container">
                <div className="modern-spinner"></div>
                <p>Loading pending users...</p>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="modern-empty-state">
                <div className="empty-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3>No Pending Applications</h3>
                <p>All applications have been reviewed</p>
              </div>
            ) : (
              <div className="modern-users-grid">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="modern-user-card">
                    <div className="user-card-header">
                      <div className="user-avatar">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <h3 className="user-name">{user.full_name}</h3>
                        <p className="user-email">{user.email}</p>
                      </div>
                      <span className="status-badge badge-pending">Pending</span>
                    </div>
                    
                    <div className="user-card-body">
                      <div className="info-row">
                        <span className="info-label">
                          <svg className="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Branch
                        </span>
                        <span className="info-value">{user.branch}</span>
                      </div>
                      
                      <div className="info-row">
                        <span className="info-label">
                          <svg className="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Company
                        </span>
                        <span className="info-value">{user.company_name || 'Not specified'}</span>
                      </div>
                      
                      <div className="info-row">
                        <span className="info-label">
                          <svg className="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Job Type
                        </span>
                        <span className="info-value">{user.job_type || 'N/A'}</span>
                      </div>
                      
                      <div className="info-row">
                        <span className="info-label">
                          <svg className="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Applied
                        </span>
                        <span className="info-value">{new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    
                    <div className="user-card-footer">
                      <button
                        className="action-btn btn-view"
                        onClick={() => handleViewUserDetails(user)}
                      >
                        <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </button>
                      <button
                        className="action-btn btn-approve"
                        onClick={() => handleApproveUser(user.id)}
                      >
                        <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </button>
                      <button
                        className="action-btn btn-reject"
                        onClick={() => handleRejectUser(user.id)}
                      >
                        <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approved Users Tab */}
        {activeTab === 'approved' && (
          <div className="content-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Approved Users</h2>
                <p className="section-subtitle">{approvedUsers.length} active alumni members</p>
              </div>
            </div>
            
            {isLoading ? (
              <div className="loading-container">
                <div className="modern-spinner"></div>
                <p>Loading approved users...</p>
              </div>
            ) : approvedUsers.length === 0 ? (
              <div className="modern-empty-state">
                <div className="empty-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3>No Approved Users Yet</h3>
                <p>Approved users will appear here</p>
              </div>
            ) : (
              <div className="modern-table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Branch</th>
                      <th>Company</th>
                      <th>Approved Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="table-user">
                            <div className="table-avatar">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="table-user-name">{user.full_name}</div>
                              <div className="table-user-email">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="table-badge branch-badge">{user.branch || '-'}</span>
                        </td>
                        <td className="table-company">{user.company_name || 'Not specified'}</td>
                        <td className="table-date">
                          {new Date(user.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td>
                          <span className="status-badge badge-approved">
                            <svg className="badge-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Active
                          </span>
                        </td>
                        <td>
                          <div className="approved-actions">
                            <button
                              type="button"
                              className="action-btn btn-view-profile"
                              onClick={() => handleViewProfile(user.id)}
                            >
                              View Profile
                            </button>
                            <button
                              type="button"
                              className="action-btn btn-reject btn-revoke"
                              onClick={() => handleRevokeUser(user.id)}
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="reports-section">
          <div className="report-header">
            <div>
              <h2>Generate User Reports</h2>
              <p className="report-subtitle">Filter and export alumni data to Excel</p>
            </div>
            {getActiveFilterCount() > 0 && (
              <div className="filter-badge-count">
                {getActiveFilterCount()} Active Filters
              </div>
            )}
          </div>

          {!filterOptions ? (
            <div className="loading-spinner"></div>
          ) : (
            <div className="reports-content">
              {/* Quick Filters */}
              <div className="quick-filters-card">
                <h3>Quick Filters</h3>
                <div className="quick-filters-row">
                  <button className="quick-filter-btn government" onClick={() => applyQuickFilter('government')}>
                    Government Sector
                  </button>
                  <button className="quick-filter-btn recent" onClick={() => applyQuickFilter('recent')}>
                    Recent Graduates
                  </button>
                  <button className="quick-filter-btn experienced" onClick={() => applyQuickFilter('experienced')}>
                    Senior Experience
                  </button>
                  <button className="quick-filter-btn all" onClick={() => applyQuickFilter('all')}>
                    All Users
                  </button>
                </div>
              </div>

              {/* Custom Filters */}
              <div className="filter-card">
                <div className="filter-card-header">
                  <h3>Custom Filters</h3>
                  <button className="clear-all-btn" onClick={clearAllFilters}>Clear All</button>
                </div>

                {/* Branch Filter */}
                {filterOptions.branches && filterOptions.branches.length > 0 && (
                  <div className="filter-group">
                    <div className="filter-header" onClick={() => toggleSection('branch')}>
                      <span className="filter-title">
                        {expandedSections.branch ? '▼' : '▶'} Branch
                        {selectedFilters.branch.length > 0 && ` (${selectedFilters.branch.length})`}
                      </span>
                      <div className="filter-actions">
                        {selectedFilters.branch.length > 0 && (
                          <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearCategory('branch'); }}>Clear</button>
                        )}
                        <button className="select-all-btn" onClick={(e) => { e.stopPropagation(); selectAllInCategory('branch', filterOptions.branches); }}>Select All</button>
                      </div>
                    </div>
                    {expandedSections.branch && (
                      <div className="filter-chips">
                        {filterOptions.branches.map((branch: string) => (
                          <button
                            key={branch}
                            className={`filter-chip ${selectedFilters.branch.includes(branch) ? 'active' : ''}`}
                            onClick={() => toggleFilterSelection('branch', branch)}
                          >
                            {branch}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sector Filter */}
                {filterOptions.sectors && filterOptions.sectors.length > 0 && (
                  <div className="filter-group">
                    <div className="filter-header" onClick={() => toggleSection('sector')}>
                      <span className="filter-title">
                        {expandedSections.sector ? '▼' : '▶'} Job Sector
                        {selectedFilters.sector.length > 0 && ` (${selectedFilters.sector.length})`}
                      </span>
                      <div className="filter-actions">
                        {selectedFilters.sector.length > 0 && (
                          <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearCategory('sector'); }}>Clear</button>
                        )}
                        <button className="select-all-btn" onClick={(e) => { e.stopPropagation(); selectAllInCategory('sector', filterOptions.sectors); }}>Select All</button>
                      </div>
                    </div>
                    {expandedSections.sector && (
                      <div className="filter-chips">
                        {filterOptions.sectors.map((sector: string) => (
                          <button
                            key={sector}
                            className={`filter-chip ${selectedFilters.sector.includes(sector) ? 'active' : ''}`}
                            onClick={() => toggleFilterSelection('sector', sector)}
                          >
                            {sector}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Job Type Filter */}
                {filterOptions.jobTypes && filterOptions.jobTypes.length > 0 && (
                  <div className="filter-group">
                    <div className="filter-header" onClick={() => toggleSection('jobType')}>
                      <span className="filter-title">
                        {expandedSections.jobType ? '▼' : '▶'} Job Type
                        {selectedFilters.jobType.length > 0 && ` (${selectedFilters.jobType.length})`}
                      </span>
                      <div className="filter-actions">
                        {selectedFilters.jobType.length > 0 && (
                          <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearCategory('jobType'); }}>Clear</button>
                        )}
                        <button className="select-all-btn" onClick={(e) => { e.stopPropagation(); selectAllInCategory('jobType', filterOptions.jobTypes); }}>Select All</button>
                      </div>
                    </div>
                    {expandedSections.jobType && (
                      <div className="filter-chips">
                        {filterOptions.jobTypes.map((jobType: string) => (
                          <button
                            key={jobType}
                            className={`filter-chip ${selectedFilters.jobType.includes(jobType) ? 'active' : ''}`}
                            onClick={() => toggleFilterSelection('jobType', jobType)}
                          >
                            {jobType}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Status Filter */}
                {filterOptions.statuses && filterOptions.statuses.length > 0 && (
                  <div className="filter-group">
                    <div className="filter-header" onClick={() => toggleSection('status')}>
                      <span className="filter-title">
                        {expandedSections.status ? '▼' : '▶'} Status
                        {selectedFilters.status.length > 0 && ` (${selectedFilters.status.length})`}
                      </span>
                      <div className="filter-actions">
                        {selectedFilters.status.length > 0 && (
                          <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearCategory('status'); }}>Clear</button>
                        )}
                        <button className="select-all-btn" onClick={(e) => { e.stopPropagation(); selectAllInCategory('status', filterOptions.statuses); }}>Select All</button>
                      </div>
                    </div>
                    {expandedSections.status && (
                      <div className="filter-chips">
                        {filterOptions.statuses.map((status: string) => (
                          <button
                            key={status}
                            className={`filter-chip ${selectedFilters.status.includes(status) ? 'active' : ''}`}
                            onClick={() => toggleFilterSelection('status', status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Graduation Year Filter */}
                <div className="filter-group">
                  <div className="filter-header" onClick={() => toggleSection('years')}>
                    <span className="filter-title">
                      {expandedSections.years ? '▼' : '▶'} Graduation Year
                    </span>
                  </div>
                  {expandedSections.years && (
                    <div className="filter-inputs">
                      <input
                        type="number"
                        className="form-input"
                        placeholder="From (e.g., 2010)"
                        value={selectedFilters.graduationYearFrom}
                        onChange={(e) => setSelectedFilters({...selectedFilters, graduationYearFrom: e.target.value})}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="To (e.g., 2024)"
                        value={selectedFilters.graduationYearTo}
                        onChange={(e) => setSelectedFilters({...selectedFilters, graduationYearTo: e.target.value})}
                      />
                    </div>
                  )}
                </div>

                {/* Experience Filter */}
                <div className="filter-group">
                  <div className="filter-header" onClick={() => toggleSection('experience')}>
                    <span className="filter-title">
                      {expandedSections.experience ? '▼' : '▶'} Experience (Years)
                    </span>
                  </div>
                  {expandedSections.experience && (
                    <div className="filter-inputs">
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Min (e.g., 0)"
                        value={selectedFilters.experienceMin}
                        onChange={(e) => setSelectedFilters({...selectedFilters, experienceMin: e.target.value})}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Max (e.g., 20)"
                        value={selectedFilters.experienceMax}
                        onChange={(e) => setSelectedFilters({...selectedFilters, experienceMax: e.target.value})}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Report Button */}
              <button
                className="button button-primary generate-report-btn"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? 'Generating...' : '📊 Generate Report'}
              </button>
            </div>
          )}
        </div>
      )}

        {/* Broadcast Tab */}
        {activeTab === 'broadcast' && (
          <div className="content-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Broadcast Message</h2>
                <p className="section-subtitle">Send notifications to all approved users</p>
              </div>
            </div>
            
            <div className="broadcast-container">
              <div className="broadcast-info">
                <div className="info-card">
                  <svg className="info-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4>Important Information</h4>
                    <p>This message will be sent to all <strong>{stats.approved || 0} approved users</strong>. Make sure to review before sending.</p>
                  </div>
                </div>
              </div>
              
              <form onSubmit={handleSendBroadcast} className="modern-broadcast-form">
                <div className="form-group-modern">
                  <label className="form-label">
                    <svg className="label-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Message Title
                  </label>
                  <input
                    type="text"
                    className="form-input-modern"
                    placeholder="e.g., Important Update, New Event Announcement"
                    value={broadcast.title}
                    onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-modern">
                  <label className="form-label">
                    <svg className="label-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Message Content
                  </label>
                  <textarea
                    className="form-textarea-modern"
                    rows={8}
                    placeholder="Write your message here... Be clear and concise."
                    value={broadcast.message}
                    onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })}
                    required
                  />
                  <div className="character-count">
                    {broadcast.message.length} characters
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => setBroadcast({ title: '', message: '' })}
                  >
                    Clear Form
                  </button>
                  <button type="submit" className="btn-primary">
                    <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Broadcast
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Modern User Details Modal */}
      {showModal && selectedUser && (
        <div className="modern-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modern-modal-header">
              <div className="modal-title-section">
                <div className="modal-user-avatar">
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="modal-title">User Details</h2>
                  <p className="modal-subtitle">{selectedUser.email}</p>
                </div>
              </div>
              <button className="modern-modal-close" onClick={() => setShowModal(false)}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modern-modal-body">
              <div className="modal-section">
                <h3 className="modal-section-title">Personal Information</h3>
                <div className="modal-grid">
                  <div className="modal-field">
                    <label className="modal-label">Full Name</label>
                    <div className="modal-value">{selectedUser.full_name}</div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Mobile Number</label>
                    <div className="modal-value">{selectedUser.mobile_number || 'Not provided'}</div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">City</label>
                    <div className="modal-value">{selectedUser.city || 'Not specified'}</div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Graduation Year</label>
                    <div className="modal-value">{selectedUser.graduation_year || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div className="modal-section">
                <h3 className="modal-section-title">Educational Background</h3>
                <div className="modal-grid">
                  <div className="modal-field">
                    <label className="modal-label">Branch</label>
                    <div className="modal-value">
                      <span className="modal-badge">{selectedUser.branch}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="modal-section">
                <h3 className="modal-section-title">Professional Information</h3>
                <div className="modal-grid">
                  <div className="modal-field">
                    <label className="modal-label">Company</label>
                    <div className="modal-value">{selectedUser.company_name || 'Not specified'}</div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Designation</label>
                    <div className="modal-value">{selectedUser.designation || 'N/A'}</div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Job Type</label>
                    <div className="modal-value">{selectedUser.job_type || 'N/A'}</div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Sector</label>
                    <div className="modal-value">{selectedUser.job_sector || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              {(selectedUser.linkedin_url || selectedUser.id_proof_url) && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Documents & Links</h3>
                  <div className="modal-links">
                    {selectedUser.linkedin_url && (
                      <a href={selectedUser.linkedin_url} target="_blank" rel="noopener noreferrer" className="modal-link">
                        <svg className="link-icon" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        View LinkedIn Profile
                      </a>
                    )}
                    {selectedUser.id_proof_url && (
                      <a href={apiClient.getPublicFileUrl(selectedUser.id_proof_url)} target="_blank" rel="noopener noreferrer" className="modal-link">
                        <svg className="link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View ID Proof Document
                      </a>
                    )}
                  </div>
                </div>
              )}
              
              <div className="modal-section">
                <h3 className="modal-section-title">Admin Actions</h3>
                <div className="form-group-modern">
                  <label className="form-label">Remarks (Optional)</label>
                  <input
                    type="text"
                    className="form-input-modern"
                    placeholder="Add your remarks here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="modern-modal-footer">
              <button
                className="modal-btn btn-approve-modal"
                onClick={() => handleApproveUser(selectedUser.id)}
              >
                <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve User
              </button>
              <button
                className="modal-btn btn-reject-modal"
                onClick={() => handleRejectUser(selectedUser.id)}
              >
                <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
