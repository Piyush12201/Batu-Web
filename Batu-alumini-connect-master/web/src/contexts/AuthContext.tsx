import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../services/api.client';
import socketService from '../services/socket.service';

interface User {
  id: string;
  email: string;
  full_name: string;
  branch?: string;
  graduation_year?: number;
  company_name?: string;
  job_title?: string;
  profile_picture?: string;
  profile_picture_url?: string;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginUser: (email: string, password: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const userType = localStorage.getItem('userType');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      apiClient.setToken(token);
      const response = await apiClient.getCurrentUser();
      const resolvedUser = response.data?.user || response.data;
      
      if (resolvedUser) {
        setUser(resolvedUser);
        setIsAdmin(userType === 'admin');
        await socketService.connect();
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userType');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userType');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    return loginUser(email, password);
  };

  const loginUser = async (email: string, password: string) => {
    const response = await apiClient.loginUser({ email, password });
    
    if (response.error) {
      throw new Error(response.error);
    }

    if (response.data) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('userType', 'user');
      apiClient.setToken(response.data.accessToken);
      setIsAdmin(false);
      
      const userResponse = await apiClient.getCurrentUser();
      const resolvedUser = userResponse.data?.user || userResponse.data;
      if (resolvedUser) {
        setUser(resolvedUser);
        await socketService.connect();
      }
    }
  };

  const loginAdmin = async (email: string, password: string) => {
    const response = await apiClient.loginAdmin({ email, password });
    
    if (response.error) {
      throw new Error(response.error);
    }

    if (response.data) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('userType', 'admin');
      apiClient.setToken(response.data.accessToken);
      setIsAdmin(true);
      
      // Store admin info
      const adminData = response.data.admin || response.data;
      setUser({
        id: adminData.id,
        email: adminData.email,
        full_name: adminData.full_name || 'Admin User',
        is_admin: true,
      } as User);
      
      await socketService.connect();
    }
  };

  const register = async (userData: any) => {
    const response = await apiClient.register(userData);
    
    if (response.error) {
      throw new Error(response.error);
    }

    if (response.data) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      apiClient.setToken(response.data.accessToken);
      
      const userResponse = await apiClient.getCurrentUser();
      const resolvedUser = userResponse.data?.user || userResponse.data;
      if (resolvedUser) {
        setUser(resolvedUser);
        await socketService.connect();
      }
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userType');
      apiClient.clearToken();
      socketService.disconnect();
      setUser(null);
      setIsAdmin(false);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const refreshUser = async () => {
    const response = await apiClient.getCurrentUser();
    const resolvedUser = response.data?.user || response.data;
    if (resolvedUser) {
      setUser(resolvedUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        login,
        loginUser,
        loginAdmin,
        register,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
