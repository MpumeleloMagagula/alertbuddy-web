import axios, { AxiosInstance } from 'axios';
import type {
  ApiResponse,
  ServerStatus,
  Device,
  StandbyInfo,
  HandoverLog,
  TestAlertFormData,
  User,
  TeamMember,
  Shift,
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  // ========== Server Status ==========
  async getServerStatus(): Promise<ServerStatus> {
    const { data } = await this.api.get<ServerStatus>('/api/status');
    return data;
  }

  // ========== Device Management ==========
  async getDevices(): Promise<Device[]> {
    const { data } = await this.api.get<Device[]>('/api/devices');
    return data;
  }

  async unregisterDevice(deviceId: string): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>('/api/devices/unregister', { deviceId });
    return data;
  }

  // ========== Standby Management ==========
  async getCurrentStandby(): Promise<StandbyInfo> {
    const { data } = await this.api.get<StandbyInfo>('/api/standby/current');
    return data;
  }

  async updateStandby(email: string, displayName: string, updatedByEmail: string): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>('/api/standby/update', {
      email,
      displayName,
      updatedByEmail,
    });
    return data;
  }

  async clearStandby(): Promise<ApiResponse> {
    const { data } = await this.api.delete<ApiResponse>('/api/standby');
    return data;
  }

  async getHandoverHistory(limit: number = 20): Promise<HandoverLog[]> {
    const { data } = await this.api.get<HandoverLog[]>(`/api/standby/history?limit=${limit}`);
    return data;
  }

  // ========== Alert Management ==========
  async sendTestAlert(alertData: TestAlertFormData): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>('/api/alerts/send', alertData);
    return data;
  }

  async sendStandbyAlert(alertData: TestAlertFormData): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>('/api/alerts/send-standby', alertData);
    return data;
  }

  async sendTopicAlert(topic: string, alertData: TestAlertFormData): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>('/api/alerts/send-topic', {
      topic,
      ...alertData,
    });
    return data;
  }

  // ========== Grafana Webhook (for testing) ==========
  async sendGrafanaWebhook(payload: any): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>('/api/grafana/webhook', payload);
    return data;
  }

  // ========== User Management (requires backend extension) ==========
  async getUsers(): Promise<User[]> {
    const { data } = await this.api.get<User[]>('/api/users');
    return data;
  }

  async createUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    const { data } = await this.api.post<ApiResponse<User>>('/api/users', userData);
    return data;
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    const { data } = await this.api.put<ApiResponse<User>>(`/api/users/${userId}`, userData);
    return data;
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    const { data} = await this.api.delete<ApiResponse>(`/api/users/${userId}`);
    return data;
  }

  // ========== Team Member Management (requires backend extension) ==========
  async getTeamMembers(): Promise<TeamMember[]> {
    const { data } = await this.api.get<TeamMember[]>('/api/team');
    return data;
  }

  async updateTeamMember(memberId: string, memberData: Partial<TeamMember>): Promise<ApiResponse> {
    const { data } = await this.api.put<ApiResponse>(`/api/team/${memberId}`, memberData);
    return data;
  }

  // ========== Shift Management (requires backend extension) ==========
  async getShifts(): Promise<Shift[]> {
    const { data } = await this.api.get<Shift[]>('/api/shifts');
    return data;
  }

  async createShift(shiftData: Partial<Shift>): Promise<ApiResponse<Shift>> {
    const { data } = await this.api.post<ApiResponse<Shift>>('/api/shifts', shiftData);
    return data;
  }

  async deleteShift(shiftId: string): Promise<ApiResponse> {
    const { data } = await this.api.delete<ApiResponse>(`/api/shifts/${shiftId}`);
    return data;
  }

  async activateShift(shiftId: string): Promise<ApiResponse> {
    const { data } = await this.api.post<ApiResponse>(`/api/shifts/${shiftId}/activate`);
    return data;
  }

  // ========== Enhanced Features ==========
  async bulkMarkAlertsRead(alertIds: string[], userId?: string, userEmail?: string): Promise<any> {
    const { data } = await this.api.post('/api/alerts/bulk-mark-read', { alertIds, userId, userEmail });
    return data;
  }

  async bulkDeleteAlerts(alertIds: string[], userId?: string, userEmail?: string): Promise<any> {
    const { data } = await this.api.post('/api/alerts/bulk-delete', { alertIds, userId, userEmail });
    return data;
  }

  async getAuditLogs(params?: { limit?: number; action?: string; startDate?: number; endDate?: number }): Promise<any[]> {
    const { data } = await this.api.get('/api/audit-logs', { params });
    return data;
  }

  async getDeviceHealthSummary(): Promise<any> {
    const { data } = await this.api.get('/api/devices/health-summary');
    return data;
  }

  async getAlertTemplates(): Promise<any[]> {
    const { data } = await this.api.get('/api/alert-templates');
    return data;
  }

  async createAlertTemplate(templateData: any): Promise<any> {
    const { data } = await this.api.post('/api/alert-templates', templateData);
    return data;
  }

  async deleteAlertTemplate(templateId: string): Promise<any> {
    const { data } = await this.api.delete(`/api/alert-templates/${templateId}`);
    return data;
  }
}

export default new ApiService();
