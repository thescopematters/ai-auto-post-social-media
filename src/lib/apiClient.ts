import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse>) => {
        if (error.response?.status === 401) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              });
              localStorage.setItem('accessToken', data.data.accessToken);
              localStorage.setItem('refreshToken', data.data.refreshToken);

              if (error.config) {
                error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
                return axios(error.config);
              }
            } catch (refreshError) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/signin';
            }
          } else {
            window.location.href = '/signin';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

export const authApi = {
  register: (email: string, password: string, fullName: string) =>
    apiClient.post('/auth/register', { email, password, fullName }),

  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),

  logout: () =>
    apiClient.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),

  getCurrentUser: () =>
    apiClient.get('/auth/me'),
};

export const workspaceApi = {
  getAll: () =>
    apiClient.get('/workspaces'),

  getById: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}`),

  create: (name: string, brandColor?: string, logoUrl?: string) =>
    apiClient.post('/workspaces', { name, brandColor, logoUrl }),

  update: (workspaceId: string, name: string, brandColor?: string, logoUrl?: string) =>
    apiClient.put(`/workspaces/${workspaceId}`, { name, brandColor, logoUrl }),

  delete: (workspaceId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}`),

  getMembers: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/members`),

  addMember: (workspaceId: string, userId: string, role: string) =>
    apiClient.post(`/workspaces/${workspaceId}/members`, { userId, role }),

  updateMember: (workspaceId: string, memberId: string, role: string) =>
    apiClient.put(`/workspaces/${workspaceId}/members/${memberId}`, { role }),

  removeMember: (workspaceId: string, memberId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`),
};

export const documentApi = {
  getAll: (workspaceId: string, page = 1, limit = 20, search?: string) =>
    apiClient.get(`/workspaces/${workspaceId}/documents`, {
      params: { page, limit, search },
    }),

  getById: (workspaceId: string, documentId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/documents/${documentId}`),

  create: (workspaceId: string, data: {
    title: string;
    fileType: string;
    fileUrl?: string;
    contentText?: string;
    metadata?: any;
  }) =>
    apiClient.post(`/workspaces/${workspaceId}/documents`, data),

  update: (workspaceId: string, documentId: string, data: any) =>
    apiClient.put(`/workspaces/${workspaceId}/documents/${documentId}`, data),

  delete: (workspaceId: string, documentId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/documents/${documentId}`),

  getStats: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/documents/stats`),
};

export const contentApi = {
  generate: (workspaceId: string, data: {
    documentId: string;
    platform: string;
    tone: string;
    framework?: string;
    agentConfigId?: string;
    variantCount?: number;
  }) =>
    apiClient.post(`/workspaces/${workspaceId}/generate`, data),

  getAllPosts: (workspaceId: string, page = 1, limit = 20, status?: string, platform?: string) =>
    apiClient.get(`/workspaces/${workspaceId}/posts`, {
      params: { page, limit, status, platform },
    }),

  getPostById: (workspaceId: string, postId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/posts/${postId}`),

  updatePost: (workspaceId: string, postId: string, data: any) =>
    apiClient.put(`/workspaces/${workspaceId}/posts/${postId}`, data),

  deletePost: (workspaceId: string, postId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/posts/${postId}`),

  moderatePost: (workspaceId: string, postId: string, action: string, reason?: string) =>
    apiClient.post(`/workspaces/${workspaceId}/posts/${postId}/moderate`, { action, reason }),

  getScheduledPosts: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/scheduled-posts`),

  schedulePost: (workspaceId: string, data: {
    postId: string;
    socialAccountId: string;
    scheduledTime: string;
  }) =>
    apiClient.post(`/workspaces/${workspaceId}/schedule`, data),

  updateScheduledPost: (workspaceId: string, postId: string, data: { content: string }) =>
    apiClient.patch(`/workspaces/${workspaceId}/scheduled-posts/${postId}`, data),

  deleteScheduledPost: (workspaceId: string, postId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/scheduled-posts/${postId}`),
};

export const socialAccountsApi = {
  getAccounts: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/social-accounts`),

  connectAccount: (workspaceId: string, data: any) =>
    apiClient.post(`/workspaces/${workspaceId}/social-accounts`, data),

  disconnectAccount: (workspaceId: string, platform: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/social-accounts/${platform}`),

  updateAccount: (workspaceId: string, accountId: string, data: any) =>
    apiClient.put(`/workspaces/${workspaceId}/social-accounts/${accountId}`, data),
};

export const dashboardApi = {
  getStats: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/stats`),

  getRecentActivity: (workspaceId: string, limit = 10) =>
    apiClient.get(`/workspaces/${workspaceId}/activity`, { params: { limit } }),

  getAnalytics: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/analytics`),
};

export const schedulerApi = {
  publishNow: (data: { postId: string }) =>
    apiClient.post('/publish-now', data),
};

export default apiClient;