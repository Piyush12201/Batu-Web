import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api.client';
import batuLogo from '../../assets/batu_logo-removebg-preview.png';
import './LoginPage.css';
import './RegisterPage.css';

interface FormData {
  // Step 1 - Personal Information
  full_name: string;
  branch: string;
  graduation_year: string;
  mobile_number: string;
  email: string;
  city: string;
  linkedin_url: string;

  // Step 2 - Professional Information
  job_type: string;
  job_sector: string;
  company_name: string;
  designation: string;
  years_of_experience: string;
  skills: string[];

  // Step 3 - Verification
  password: string;
  confirmPassword: string;
  id_proof: File | null;
}

const RegisterPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    branch: '',
    graduation_year: new Date().getFullYear().toString(),
    mobile_number: '',
    email: '',
    city: '',
    linkedin_url: '',
    job_type: '',
    job_sector: '',
    company_name: '',
    designation: '',
    years_of_experience: '0',
    skills: [],
    password: '',
    confirmPassword: '',
    id_proof: null,
  });

  const [newSkill, setNewSkill] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const branches = [
    'Computer Science Engineering',
    'Information Technology',
    'Electronics Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical Engineering',
    'Chemical Engineering',
    'Aerospace Engineering',
    'Biotechnology',
    'Environmental Engineering',
    'Production Engineering',
    'Thermal Engineering',
    'Manufacturing Engineering',
    'Instrumentation Engineering',
    'Architecture',
  ];

  const jobTypes = ['Service', 'Business', 'Higher Studies'];
  const jobSectors = ['Government', 'Semi Government', 'Startup', 'Private'];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFormData((prev) => ({
        ...prev,
        id_proof: e.target.files![0],
      }));
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const validateStep1 = () => {
    if (
      !formData.full_name ||
      !formData.branch ||
      !formData.graduation_year ||
      !formData.mobile_number ||
      !formData.email ||
      !formData.city
    ) {
      setError('Please fill in all required fields');
      return false;
    }

    if (!/^\d{10}$/.test(formData.mobile_number.replace(/[^\d]/g, ''))) {
      setError('Please enter a valid 10-digit mobile number');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (
      !formData.job_type ||
      !formData.company_name ||
      !formData.designation
    ) {
      setError('Please fill in all required fields');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password || !formData.confirmPassword) {
      setError('Please enter both password and confirmation');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (!formData.id_proof) {
      setError('Please upload an ID proof document');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    setError('');

    if (currentStep === 1 && !validateStep1()) {
      return;
    }

    if (currentStep === 2 && !validateStep2()) {
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateStep3()) {
      return;
    }

    setIsLoading(true);

    try {
      // Upload ID proof first so backend can store a real URL.
      const uploadResult = await apiClient.uploadIdProof(formData.id_proof!);
      if (uploadResult.error || !uploadResult.data?.url) {
        throw new Error(uploadResult.error || 'Failed to upload ID proof');
      }

      // Prepare data for API
      const userData = {
        full_name: formData.full_name,
        email: formData.email,
        mobile_number: formData.mobile_number,
        branch: formData.branch,
        graduation_year: parseInt(formData.graduation_year),
        city: formData.city,
        linkedin_url: formData.linkedin_url || undefined,
        job_type: formData.job_type || undefined,
        job_sector: formData.job_sector || undefined,
        company_name: formData.company_name || undefined,
        designation: formData.designation || undefined,
        years_of_experience: parseInt(formData.years_of_experience) || 0,
        skills: formData.skills.length > 0 ? formData.skills : undefined,
        password: formData.password,
        id_proof_url: uploadResult.data.url,
      };

      await register(userData);
      navigate('/feed');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
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
        <Link to="/" className="auth-back-link">
          ← Back to Home
        </Link>

        <div className="auth-card">
          <div className="auth-logo-header">
            <img src={batuLogo} alt="BATU" className="auth-logo-img" />
            <p className="auth-university-name">Dr. Babasaheb Ambedkar Technological University</p>
          </div>
          <h1 className="auth-title">Join Alumni Connect</h1>
          <p className="auth-subtitle">
            Create your account &mdash; Step {currentStep} of 3
          </p>

          <div className="step-indicator">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`step ${step === currentStep ? 'active' : ''} ${
                  step < currentStep ? 'completed' : ''
                }`}
              >
                {step}
              </div>
            ))}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={currentStep === 3 ? handleSubmit : (e) => {
            e.preventDefault();
            handleNext();
          }} className="auth-form">
            {currentStep === 1 && (
              <div className="form-step">
                <h2 className="step-title">Personal Information</h2>

                <div className="form-group">
                  <label htmlFor="full_name" className="form-label">
                    Full Name *
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="branch" className="form-label">
                      Branch *
                    </label>
                    <select
                      id="branch"
                      name="branch"
                      className="form-input"
                      value={formData.branch}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
                    >
                      <option value="">Select your branch</option>
                      {branches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="graduation_year" className="form-label">
                      Graduation Year *
                    </label>
                    <input
                      id="graduation_year"
                      name="graduation_year"
                      type="number"
                      className="form-input"
                      placeholder="2025"
                      value={formData.graduation_year}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="mobile_number" className="form-label">
                    Mobile Number *
                  </label>
                  <input
                    id="mobile_number"
                    name="mobile_number"
                    type="tel"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={formData.mobile_number}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Email *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city" className="form-label">
                      City *
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      className="form-input"
                      placeholder="Mumbai"
                      value={formData.city}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="linkedin_url" className="form-label">
                      LinkedIn URL (Optional)
                    </label>
                    <input
                      id="linkedin_url"
                      name="linkedin_url"
                      type="url"
                      className="form-input"
                      placeholder="linkedin.com/in/yourprofile"
                      value={formData.linkedin_url}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="form-step">
                <h2 className="step-title">Professional Information</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="job_type" className="form-label">
                      Job Type *
                    </label>
                    <select
                      id="job_type"
                      name="job_type"
                      className="form-input"
                      value={formData.job_type}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
                    >
                      <option value="">Select job type</option>
                      {jobTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="job_sector" className="form-label">
                      Job Sector
                    </label>
                    <select
                      id="job_sector"
                      name="job_sector"
                      className="form-input"
                      value={formData.job_sector}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    >
                      <option value="">Select sector</option>
                      {jobSectors.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="company_name" className="form-label">
                    Company Name *
                  </label>
                  <input
                    id="company_name"
                    name="company_name"
                    type="text"
                    className="form-input"
                    placeholder="Your Company"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="designation" className="form-label">
                      Designation *
                    </label>
                    <input
                      id="designation"
                      name="designation"
                      type="text"
                      className="form-input"
                      placeholder="Senior Developer"
                      value={formData.designation}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="years_of_experience" className="form-label">
                      Years of Experience
                    </label>
                    <input
                      id="years_of_experience"
                      name="years_of_experience"
                      type="number"
                      className="form-input"
                      placeholder="0"
                      value={formData.years_of_experience}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Skills</label>
                  <div className="skill-input-wrapper">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Add a skill (e.g., React, TypeScript)"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="add-skill-btn"
                      onClick={addSkill}
                      disabled={isLoading}
                    >
                      Add
                    </button>
                  </div>

                  {formData.skills.length > 0 && (
                    <div className="skills-list">
                      {formData.skills.map((skill) => (
                        <div key={skill} className="skill-tag">
                          {skill}
                          <button
                            type="button"
                            className="remove-skill-btn"
                            onClick={() => removeSkill(skill)}
                            disabled={isLoading}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="form-step">
                <h2 className="step-title">Verification & Credentials</h2>

                <div className="form-group">
                  <label htmlFor="id_proof" className="form-label">
                    ID Proof (Optional)
                  </label>
                  <div className="file-input-wrapper">
                    <input
                      id="id_proof"
                      name="id_proof"
                      type="file"
                      className="form-file-input"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      disabled={isLoading}
                    />
                    <label htmlFor="id_proof" className="file-input-label">
                      {formData.id_proof
                        ? `✓ ${formData.id_proof.name}`
                        : '📎 Upload ID Proof'}
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password *
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
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

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm Password *
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="auth-button secondary"
                  onClick={handlePrevious}
                  disabled={isLoading}
                >
                  Previous
                </button>
              )}

              <button
                type={currentStep === 3 ? 'submit' : 'button'}
                className="auth-button"
                onClick={currentStep < 3 ? handleNext : undefined}
                disabled={isLoading}
              >
                {isLoading
                  ? 'Processing...'
                  : currentStep === 3
                    ? 'Complete Registration'
                    : 'Next'}
              </button>
            </div>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
