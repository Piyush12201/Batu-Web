import React, { useState, useEffect } from 'react';
import apiClient from '../services/api.client';
import './HelpDeskPage.css';

interface Ticket {
  id: string;
  category?: string;
  is_asking?: boolean;
  title: string;
  description: string;
  status: string;
  responses_count?: number;
  created_at: string;
}

const HelpDeskPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await apiClient.getHelpDeskPosts({ page: 1, limit: 20 });
      if (response.data) {
        if (Array.isArray(response.data)) {
          setTickets(response.data);
        } else {
          const data = response.data as any;
          setTickets(Array.isArray(data.posts) ? data.posts : []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.createHelpDeskPost({
        category: 'Other',
        title: formData.title,
        description: formData.description,
        is_asking: true,
      });
      if (response.data) {
        alert('Ticket created successfully!');
        setShowCreateForm(false);
        setFormData({ title: '', description: '' });
        fetchTickets();
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      alert('Failed to create ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#2563EB';
      case 'in_progress':
        return '#F59E0B';
      case 'resolved':
        return '#16A34A';
      case 'closed':
        return '#94A3B8';
      default:
        return '#475569';
    }
  };

  return (
    <div className="helpdesk-page">
      <div className="page-header">
        <h1 className="page-title">Help Desk</h1>
        <button
          className="button button-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Ticket'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-ticket-card">
          <h2>Create New Ticket</h2>
          <form onSubmit={handleSubmit} className="ticket-form">
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
              Submit Ticket
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="loading-spinner"></div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">No tickets yet</div>
      ) : (
        <div className="tickets-list">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="ticket-card">
              <div className="ticket-header">
                <h3>{ticket.title}</h3>
                <span
                  className="ticket-status"
                  style={{ backgroundColor: `${getStatusColor(ticket.status)}20`, color: getStatusColor(ticket.status) }}
                >
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
              <p className="ticket-description">{ticket.description}</p>
              <div className="ticket-footer">
                {typeof ticket.responses_count === 'number' && (
                  <span>{ticket.responses_count} responses</span>
                )}
                <span className="ticket-date">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpDeskPage;
