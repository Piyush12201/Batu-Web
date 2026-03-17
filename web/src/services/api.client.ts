import socketService from './socket.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    this.accessToken = null;
  }

  /**
   * Get stored access token from localStorage
   */
  getStoredToken(): string | null {
    try {
      return localStorage.getItem('accessToken');
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
    try {
      const userType = localStorage.getItem('userType');
      if (userType === 'admin') {
        return null;
      }

      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        const { accessToken, refreshToken: newRefreshToken } = data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        this.setToken(accessToken);
        socketService.updateToken(accessToken);
        
        return accessToken;
      }

      // Refresh token is no longer valid; clear stale auth to stop retry loops.
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userType');
      this.clearToken();

      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    } finally {
      this.refreshPromise = null;
    }
    })();

    return this.refreshPromise;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = this.accessToken || this.getStoredToken();
      const userType = localStorage.getItem('userType');
      const isPublicAuthEndpoint =
        endpoint === '/auth/login' ||
        endpoint === '/auth/admin-login' ||
        endpoint === '/auth/register' ||
        endpoint === '/auth/refresh-token';
      const shouldAttemptRefresh =
        endpoint !== '/auth/logout' &&
        !isPublicAuthEndpoint &&
        userType !== 'admin';
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token && !isPublicAuthEndpoint) {
        (headers as any)['Authorization'] = `Bearer ${token}`;
      }

      let response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && token && shouldAttemptRefresh) {
        const newToken = await this.refreshAccessToken();
        
        if (newToken) {
          (headers as any)['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(`${this.baseUrl}/api${endpoint}`, {
            ...options,
            headers,
          });
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || data.message || 'Request failed',
        };
      }

      return { data };
    } catch (error: any) {
      console.error('API request error:', error);
      return {
        error: error.message || 'Network error',
      };
    }
  }

  // Auth endpoints
  /**
   * Login as regular user
   * Accepts email or login_id with password
   */
  async loginUser(credentials: { email?: string; login_id?: string; password: string }) {
    return this.request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  /**
   * Login as admin
   * Accepts email and password
   */
  async loginAdmin(credentials: { email: string; password: string }) {
    return this.request<{ accessToken: string; refreshToken: string; admin: any }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  /**
   * Fallback login for backward compatibility
   */
  async login(email: string, password: string) {
    return this.loginUser({ email, password });
  }

  async register(userData: any) {
    return this.request<{ accessToken: string; refreshToken: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  async uploadIdProof(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const token = this.accessToken || this.getStoredToken();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/upload-id-proof`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Upload failed' };
      }

      return { data };
    } catch (error: any) {
      return { error: error.message || 'Upload failed' };
    }
  }

  /**
   * Get public file URL helper
   */
  getPublicFileUrl(filePath: string): string {
    if (!filePath) return filePath;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    // Normalize legacy values such as bare filenames or `uploads/...`.
    let normalizedPath = filePath.trim();
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.startsWith('uploads/')
        ? `/${normalizedPath}`
        : `/uploads/${normalizedPath}`;
    }

    const origin = this.baseUrl.replace(/\/api$/, '');
    return `${origin}${normalizedPath}`;
  }

  // Feed endpoints
  async getPosts(cursor?: string, limit: number = 20) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    return this.request<any>(`/feed/posts?${params}`);
  }

  async createPost(content: string, imageUrl?: string) {
    return this.request<any>('/feed/posts', {
      method: 'POST',
      body: JSON.stringify({ content, image_url: imageUrl }),
    });
  }

  async likePost(postId: string) {
    return this.request(`/feed/posts/${postId}/like`, { method: 'POST' });
  }

  async unlikePost(postId: string) {
    return this.request(`/feed/posts/${postId}/unlike`, { method: 'DELETE' });
  }

  async getPostComments(postId: string) {
    return this.request<any>(`/feed/posts/${postId}/comments`);
  }

  async addComment(postId: string, content: string) {
    return this.request<any>(`/feed/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deletePost(postId: string) {
    return this.request(`/feed/posts/${postId}`, { method: 'DELETE' });
  }

  // Network endpoints
  async getAlumni(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    return this.request<any>(`/network/all${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async sendConnectionRequest(userId: string) {
    return this.request(`/network/${userId}/connect`, { method: 'POST' });
  }

  async getConnectionRequests() {
    return this.request<any[]>('/network/requests');
  }

  async acceptConnectionRequest(requestId: string) {
    return this.request(`/network/requests/${requestId}/accept`, { method: 'POST' });
  }

  async rejectConnectionRequest(requestId: string) {
    return this.request(`/network/requests/${requestId}/reject`, { method: 'POST' });
  }

  async getConnections() {
    return this.request<any[]>('/network/connections');
  }

  async searchUsers(query: string = '', page: number = 1, limit: number = 20) {
    const endpoint = query.trim() === '' 
      ? `/network/all?page=${page}&limit=${limit}`
      : `/network/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    return this.request<any>(endpoint);
  }

  async getUserNetworkProfile(userId: string) {
    return this.request<any>(`/network/user/${userId}`);
  }

  async getUserConnections(userId: string, page: number = 1, limit: number = 20) {
    return this.request<any>(`/network/${userId}/connections?page=${page}&limit=${limit}`);
  }

  async connectWithUser(userId: string) {
    return this.request<any>(`/network/${userId}/connect`, {
      method: 'POST',
    });
  }

  async disconnectFromUser(userId: string) {
    return this.request<any>(`/network/${userId}/disconnect`, {
      method: 'POST',
    });
  }

  async getNetworkStats() {
    return this.request<any>('/network/stats/overview');
  }

  // Opportunities endpoints
  async getOpportunities(filters?: { type?: string; search?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const queryString = params.toString();
    return this.request<any>(`/opportunities/list${queryString ? '?' + queryString : ''}`);
  }

  async createOpportunity(opportunityData: any) {
    return this.request<any>('/opportunities/create', {
      method: 'POST',
      body: JSON.stringify(opportunityData),
    });
  }

  async getOpportunityDetails(id: string) {
    return this.request<any>(`/opportunities/${id}`);
  }

  async applyToOpportunity(id: string, data: { cover_letter?: string; resume_url?: string }) {
    return this.request<any>(`/opportunities/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bookmarkOpportunity(id: string) {
    return this.request<any>(`/opportunities/${id}/bookmark`, {
      method: 'POST',
    });
  }

  async removeOpportunityBookmark(id: string) {
    return this.request<any>(`/opportunities/${id}/unbookmark`, {
      method: 'POST',
    });
  }

  async getBookmarkedOpportunities() {
    return this.request<any>('/opportunities/bookmarks/list');
  }

  // Messages endpoints
  async getConversations() {
    return this.request<any[]>('/messages/conversations');
  }

  async getMessages(userId: string, cursor?: string, limit: number = 50) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    return this.request<any>(`/messages/with/${userId}?${params.toString()}`);
  }

  async sendMessage(recipientId: string, content: string) {
    return this.request<any>('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: recipientId, content }),
    });
  }

  async markMessagesAsRead(userId: string) {
    return this.request(`/messages/with/${userId}/read`, { method: 'POST' });
  }

  async markMessageAsRead(messageId: string) {
    return this.request<any>(`/messages/${messageId}/read`, {
      method: 'PUT',
    });
  }

  async deleteMessage(messageId: string) {
    return this.request<any>(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async getUnreadCount() {
    return this.request<{ count: number }>('/messages/unread/count');
  }

  async getOrCreateConversation(userId: string) {
    return this.request<any>('/messages/conversations/create', {
      method: 'POST',
      body: JSON.stringify({ participant_id: userId }),
    });
  }

  async getConnectedUsers() {
    return this.request<any>('/messages/connected-users');
  }

  // Notifications endpoints
  async getNotifications() {
    return this.request<any[]>('/notifications');
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/notifications/${notificationId}/read`, { method: 'PUT' });
  }

  async getUnreadNotificationsCount() {
    return this.request<{ count: number }>('/notifications/unread-count');
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  // Profile endpoints
  async updateProfile(profileData: any) {
    return this.request<any>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async getUserProfile(userId: string) {
    return this.request<any>(`/network/user/${userId}`);
  }

  async updateUserProfile(data: any) {
    return this.request<any>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadProfilePicture(imageUrl: string) {
    return this.request<any>('/users/upload-profile-picture', {
      method: 'POST',
      body: JSON.stringify({ imageUrl }),
    });
  }

  async getUserPosts(page: number = 1, limit: number = 10) {
    return this.request<any>(`/users/posts?page=${page}&limit=${limit}`);
  }

  async getUserStatus() {
    return this.request<any>('/users/status');
  }

  // Helpdesk endpoints
  async getHelpDeskTickets() {
    return this.request<any[]>('/helpdesk/posts');
  }

  async createHelpDeskTicket(ticketData: any) {
    return this.request<any>('/helpdesk/posts', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async getHelpDeskPosts(filters?: { category?: string; is_asking?: boolean; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.is_asking !== undefined) params.append('is_asking', filters.is_asking.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    return this.request<any>(`/helpdesk/posts?${params.toString()}`);
  }

  async getHelpDeskPostDetail(id: string) {
    return this.request<any>(`/helpdesk/posts/${id}`);
  }

  async createHelpDeskPost(data: { category: string; title: string; description: string; is_asking: boolean }) {
    return this.request<any>('/helpdesk/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async respondToHelpPost(postId: string, content: string) {
    return this.request<any>(`/helpdesk/posts/${postId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async markAsSolution(responseId: string) {
    return this.request<any>(`/helpdesk/responses/${responseId}/mark-solution`, {
      method: 'POST',
    });
  }

  async closeHelpDeskPost(postId: string) {
    return this.request<any>(`/helpdesk/posts/${postId}/close`, {
      method: 'POST',
    });
  }

  // Upload endpoints
  async uploadFile(file: File, type: 'profile' | 'post' = 'profile') {
    const formData = new FormData();
    formData.append('image', file);

    const endpoint = type === 'profile' ? '/api/upload/profile-picture' : '/api/upload/post-image';
    const token = this.accessToken || this.getStoredToken();
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Upload failed' };
      }

      return { data };
    } catch (error: any) {
      return { error: error.message || 'Upload failed' };
    }
  }

  // Admin endpoints
  async adminLogin(email: string, password: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getAdminStats() {
    return this.request<any>('/admin/stats');
  }

  async getPendingUsers() {
    return this.request<any>('/admin/pending-users');
  }

  async getApprovedUsers() {
    return this.request<any>('/admin/approved-users');
  }

  async approveUser(userId: string, remarks?: string) {
    return this.request<any>(`/admin/approve-user/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  async rejectUser(userId: string, remarks?: string) {
    return this.request<any>(`/admin/reject-user/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  async getUserDetails(userId: string) {
    return this.request<any>(`/admin/user-details/${userId}`);
  }

  async getReportFilters() {
    return this.request<any>('/admin/report-filters');
  }

  async generateReport(filters: any) {
    const token = this.accessToken || this.getStoredToken();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        return { error: error?.message || 'Failed to generate report' };
      }

      const blob = await response.blob();
      return { data: blob };
    } catch (error: any) {
      return { error: error.message || 'Failed to generate report' };
    }
  }

  async getAllUsers() {
    return this.request<any[]>('/admin/users');
  }

  async deleteUser(userId: string) {
    return this.request(`/admin/users/${userId}`, { method: 'DELETE' });
  }

  async sendBroadcast(title: string, message: string) {
    return this.request('/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, message }),
    });
  }

  async getBroadcasts() {
    return this.request<any[]>('/admin/broadcasts');
  }
}

const apiClient = new ApiClient();
export default apiClient;
