import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/api.client';
import './AdminUserProfilePage.css';

interface AdminUserProfile {
  id: string;
  full_name: string;
  email: string;
  mobile_number?: string;
  branch?: string;
  passport_year?: number;
  current_city?: string;
  linkedin_profile?: string;
  company_name?: string;
  designation?: string;
  job_type?: string;
  sector?: string;
  years_of_experience?: number;
  skills?: string[];
  status?: string;
  is_login_enabled?: boolean;
  last_login_at?: string;
  id_proof_url?: string;
  profile_picture_url?: string;
  profile_picture?: string;
}

const formatValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }
  return String(value);
};

const AdminUserProfilePage: React.FC = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('Invalid user id');
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.getUserDetails(userId);
        const resolvedUser = (response.data as any)?.user || response.data;

        if (!resolvedUser) {
          setError('User profile not found');
          setProfile(null);
          return;
        }

        setProfile(resolvedUser as AdminUserProfile);
      } catch (fetchError: any) {
        setError(fetchError?.message || 'Failed to load user profile');
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="admin-profile-page">
        <div className="admin-profile-card">
          <div className="admin-profile-loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="admin-profile-page">
        <div className="admin-profile-card">
          <h1 className="admin-profile-title">Admin Profile View</h1>
          <p className="admin-profile-error">{error || 'User profile not found'}</p>
          <button className="admin-profile-back" onClick={() => navigate('/admin')}>
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  const profilePicture = profile.profile_picture_url || profile.profile_picture;
  const statusClass = (profile.status || '').toLowerCase().replace(/[^a-z]/g, '');

  return (
    <div className="admin-profile-page">
      <div className="admin-profile-card">
        <div className="admin-profile-header">
          <button className="admin-profile-back" onClick={() => navigate('/admin')}>
            Back to Admin
          </button>
          <h1 className="admin-profile-title">Admin User Profile</h1>
        </div>

        <div className="admin-profile-identity">
          <div className="admin-profile-avatar">
            {profilePicture ? (
              <img src={apiClient.getPublicFileUrl(profilePicture)} alt={profile.full_name} />
            ) : (
              <span>{profile.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
            )}
          </div>
          <div>
            <h2>{profile.full_name}</h2>
            <p>{profile.email}</p>
            <div className={`admin-profile-status ${statusClass || 'unknown'}`}>
              {formatValue(profile.status)}
            </div>
          </div>
        </div>

        <div className="admin-profile-grid">
          <div className="admin-profile-field">
            <span>Phone</span>
            <strong>{formatValue(profile.mobile_number)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Branch</span>
            <strong>{formatValue(profile.branch)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Graduation Year</span>
            <strong>{formatValue(profile.passport_year)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>City</span>
            <strong>{formatValue(profile.current_city)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Job Type</span>
            <strong>{formatValue(profile.job_type)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Sector</span>
            <strong>{formatValue(profile.sector)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Company</span>
            <strong>{formatValue(profile.company_name)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Designation</span>
            <strong>{formatValue(profile.designation)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Years of Experience</span>
            <strong>{formatValue(profile.years_of_experience)}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Login Enabled</span>
            <strong>{profile.is_login_enabled ? 'Yes' : 'No'}</strong>
          </div>
          <div className="admin-profile-field">
            <span>Last Login</span>
            <strong>{profile.last_login_at ? new Date(profile.last_login_at).toLocaleString() : 'Never'}</strong>
          </div>
          <div className="admin-profile-field">
            <span>LinkedIn</span>
            <strong>
              {profile.linkedin_profile ? (
                <a href={profile.linkedin_profile} target="_blank" rel="noreferrer">Open Profile</a>
              ) : (
                'Not provided'
              )}
            </strong>
          </div>
        </div>

        <div className="admin-profile-section">
          <h3>Skills</h3>
          {Array.isArray(profile.skills) && profile.skills.length > 0 ? (
            <div className="admin-profile-skills">
              {profile.skills.map((skill) => (
                <span key={skill} className="admin-profile-skill">{skill}</span>
              ))}
            </div>
          ) : (
            <p className="admin-profile-muted">No skills listed</p>
          )}
        </div>

        <div className="admin-profile-section">
          <h3>ID Proof</h3>
          {profile.id_proof_url ? (
            <a href={apiClient.getPublicFileUrl(profile.id_proof_url)} target="_blank" rel="noreferrer" className="admin-profile-link">
              View Uploaded Document
            </a>
          ) : (
            <p className="admin-profile-muted">No ID proof uploaded</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserProfilePage;
