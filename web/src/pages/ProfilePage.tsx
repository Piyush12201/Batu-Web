import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api.client';
import './ProfilePage.css';

interface UserPost {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

const ProfilePage: React.FC = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, refreshUser, isAdmin } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    company_name: '',
    job_title: '',
    location: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [spotlightPost, setSpotlightPost] = useState<UserPost | null>(null);

  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    setAvatarError(false);
  }, [profile?.profile_picture_url, profile?.profile_picture, userId]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      if (isOwnProfile) {
        const response = await apiClient.getCurrentUser();
        if (response.data) {
          const resolvedProfile = (response.data as any).user || response.data;
          setProfile(resolvedProfile);
          setFormData({
            full_name: resolvedProfile.full_name || '',
            bio: resolvedProfile.bio || '',
            phone: resolvedProfile.mobile_number || resolvedProfile.phone || '',
            linkedin_url: resolvedProfile.linkedin_profile || resolvedProfile.linkedin_url || '',
            github_url: resolvedProfile.github_url || '',
            company_name: resolvedProfile.company_name || '',
            job_title: resolvedProfile.designation || resolvedProfile.job_title || '',
            location: resolvedProfile.current_city || resolvedProfile.location || '',
          });
        }
      } else {
        // Admin must use admin route; normal users use network route.
        const response = isAdmin
          ? await apiClient.getUserDetails(userId!)
          : await apiClient.getUserProfile(userId!);
        if (response.data) {
          const resolvedProfile = (response.data as any).user || response.data;
          setProfile(resolvedProfile);
          setIsConnected(resolvedProfile.is_connected || false);
          
          // Admin view focuses on profile details only.
          if (!isAdmin) {
            const postsResponse = await apiClient.getPosts();
            if (postsResponse.data) {
              const posts = Array.isArray(postsResponse.data)
                ? postsResponse.data
                : postsResponse.data.data || [];
              const userFilteredPosts = posts.filter((p: any) => p.author_id === userId);
              setUserPosts(userFilteredPosts);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      let profilePictureUrl = profile?.profile_picture_url || profile?.profile_picture;

      if (selectedFile) {
        const uploadResponse = await apiClient.uploadFile(selectedFile, 'profile');
        if (uploadResponse.data?.url) {
          profilePictureUrl = uploadResponse.data.url;
        }
      }

      const response = await apiClient.updateProfile({
        fullName: formData.full_name,
        mobileNumber: formData.phone,
        currentCity: formData.location,
        linkedIn: formData.linkedin_url,
        company: formData.company_name,
        designation: formData.job_title,
      });

      if (response.data) {
        if (profilePictureUrl) {
          await apiClient.uploadProfilePicture(profilePictureUrl);
        }
        alert('Profile updated successfully!');
        setIsEditing(false);
        setSelectedFile(null);
        await refreshUser();
        await fetchProfile();
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = document.querySelector('.profile-picture img') as HTMLImageElement;
        if (img) {
          img.src = reader.result as string;
        } else {
          // Replace placeholder with image preview
          const placeholder = document.querySelector('.profile-picture-placeholder');
          if (placeholder) {
            const newImg = document.createElement('img');
            newImg.src = reader.result as string;
            newImg.alt = 'Preview';
            placeholder.replaceWith(newImg);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoadingConnection(true);
      if (isConnected) {
        // Disconnect
        await apiClient.disconnectFromUser(userId!);
        setIsConnected(false);
      } else {
        // Connect
        await apiClient.sendConnectionRequest(userId!);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to update connection:', error);
      alert('Failed to update connection');
    } finally {
      setIsLoadingConnection(false);
    }
  };

  const handleMessage = async () => {
    try {
      // Create or get conversation with this user
      const response = await apiClient.getOrCreateConversation(userId!);
      const conversationId = (response.data as any)?.conversation_id || (response.data as any)?.id;
      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      } else {
        navigate(`/messages`);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      navigate(`/messages`);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-container">
        <div className="error-message">Profile not found</div>
      </div>
    );
  }

  const profileView = {
    full_name: profile.full_name,
    email: profile.email,
    mobile_number: profile.mobile_number || profile.phone,
    branch: profile.branch,
    passport_year: profile.passport_year || profile.graduation_year,
    current_city: profile.current_city || profile.location,
    linkedin_profile: profile.linkedin_profile || profile.linkedin_url,
    job_type: profile.job_type,
    sector: profile.sector,
    company_name: profile.company_name,
    designation: profile.designation || profile.job_title,
    years_of_experience: profile.years_of_experience,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    id_proof_url: profile.id_proof_url,
    status: profile.status,
    profile_picture_url: profile.profile_picture_url || profile.profile_picture,
  };

  const registrationFields = [
    { label: 'Email', value: profileView.email },
    { label: 'Phone', value: profileView.mobile_number },
    { label: 'Location', value: profileView.current_city },
    { label: 'Branch', value: profileView.branch },
    { label: 'Graduation Year', value: profileView.passport_year },
    { label: 'Job Type', value: profileView.job_type },
    { label: 'Sector', value: profileView.sector },
    { label: 'Company', value: profileView.company_name },
    { label: 'Designation', value: profileView.designation },
    { label: 'Years of Experience', value: profileView.years_of_experience },
    { label: 'Account Status', value: profileView.status },
  ];

  const completionCount = registrationFields.filter((field) => Boolean(field.value)).length;
  const completionScore = Math.round((completionCount / registrationFields.length) * 100);
  const profileStats = [
    { label: 'Profile Score', value: `${completionScore}%` },
    { label: 'Skills', value: `${profileView.skills.length}` },
    { label: 'Posts', value: `${userPosts.length}` },
  ];

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-picture">
            {profileView.profile_picture_url && !avatarError ? (
              <img
                src={apiClient.getPublicFileUrl(profileView.profile_picture_url)}
                alt={profileView.full_name}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="profile-picture-placeholder">
                {profileView.full_name?.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwnProfile && isEditing && (
              <label className="profile-picture-upload">
                <input type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                📷
              </label>
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-kicker">Alumni Identity</div>
            <h1 className="profile-name">{profileView.full_name}</h1>
            {profileView.designation && (
              <p className="profile-title">
                {profileView.designation}
                {profileView.company_name && ` at ${profileView.company_name}`}
              </p>
            )}
            <div className="profile-badges">
              {profileView.branch && <span className="profile-badge">{profileView.branch}</span>}
              {profileView.current_city && <span className="profile-badge">{profileView.current_city}</span>}
              {profileView.status && <span className="profile-badge status">{profileView.status}</span>}
            </div>
          </div>

          {isOwnProfile && !isEditing && (
            <button className="button button-primary" onClick={() => setIsEditing(true)}>
              Edit Profile
            </button>
          )}

          {!isOwnProfile && !isAdmin && (
            <div className="profile-actions">
              <button 
                className={`button ${isConnected ? 'button-secondary' : 'button-primary'}`}
                onClick={handleConnect}
                disabled={isLoadingConnection}
              >
                {isLoadingConnection ? 'Loading...' : (isConnected ? 'Disconnect' : 'Connect')}
              </button>
              <button 
                className="button button-secondary"
                onClick={handleMessage}
              >
                Message
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="profile-edit-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                />
              </div>
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

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>LinkedIn URL</label>
              <input
                type="url"
                className="form-input"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>GitHub URL</label>
              <input
                type="url"
                className="form-input"
                value={formData.github_url}
                onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
              />
            </div>

            <div className="profile-edit-actions">
              <button className="button button-primary" onClick={handleSave}>
                Save Changes
              </button>
              <button className="button button-secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-content">
            <div className="profile-stats-row">
              {profileStats.map((stat) => (
                <div key={stat.label} className="profile-stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            {profile.bio && (
              <div className="profile-section">
                <h3>About</h3>
                <p>{profile.bio}</p>
              </div>
            )}

            <div className="profile-section">
              <h3>Registration Details</h3>
              <div className="profile-info-grid">
                {registrationFields.map((field) => (
                  <div className="profile-info-card" key={field.label}>
                    <span className="profile-info-label">{field.label}</span>
                    <span className="profile-info-value">{field.value ?? 'Not provided'}</span>
                  </div>
                ))}
              </div>
            </div>

            {profileView.skills.length > 0 && (
              <div className="profile-section">
                <h3>Skills</h3>
                <div className="profile-links">
                  {profileView.skills.map((skill: string, index: number) => (
                    <span key={`${skill}-${index}`} className="profile-link">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {(profileView.linkedin_profile || profile.github_url || profileView.id_proof_url) && (
              <div className="profile-section">
                <h3>Links</h3>
                <div className="profile-links">
                  {profileView.linkedin_profile && (
                    <a href={profileView.linkedin_profile} target="_blank" rel="noopener noreferrer" className="profile-link">
                      LinkedIn
                    </a>
                  )}
                  {profile.github_url && (
                    <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="profile-link">
                      GitHub
                    </a>
                  )}
                  {profileView.id_proof_url && (
                    <a href={apiClient.getPublicFileUrl(profileView.id_proof_url)} target="_blank" rel="noopener noreferrer" className="profile-link">
                      ID Proof
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Posts Section */}
      {!isOwnProfile && userPosts.length > 0 && (
        <div className="profile-posts-section">
          <h2>Posts ({userPosts.length})</h2>
          <div className="posts-grid">
            {userPosts.map((post) => (
              <div key={post.id} className="post-grid-item" onClick={() => setSpotlightPost(post)}>
                {post.image_url && (
                  <img src={post.image_url} alt="Post" className="post-image" />
                )}
                <div className="post-overlay">
                  <div className="post-stats">
                    <span>👍 {post.likes_count}</span>
                    <span>💬 {post.comments_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {spotlightPost && (
        <div className="profile-post-spotlight-overlay" onClick={() => setSpotlightPost(null)}>
          <div className="profile-post-spotlight-modal" onClick={(e) => e.stopPropagation()}>
            <button className="profile-post-spotlight-close" onClick={() => setSpotlightPost(null)}>
              ✕
            </button>
            <div className="profile-post-spotlight-header">
              <span className="spotlight-pill">Post Spotlight</span>
              <time>{new Date(spotlightPost.created_at).toLocaleString()}</time>
            </div>
            {spotlightPost.image_url && (
              <img src={spotlightPost.image_url} alt="Spotlight post" className="profile-post-spotlight-image" />
            )}
            <p className="profile-post-spotlight-content">{spotlightPost.content}</p>
            <div className="profile-post-spotlight-stats">
              <span>👍 {spotlightPost.likes_count}</span>
              <span>💬 {spotlightPost.comments_count}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
