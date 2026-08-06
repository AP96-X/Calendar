import client from './client';
import type { UserInfo, LoginParams, ApiResponse } from '../types';

export const authApi = {
  getStatus(): Promise<UserInfo> {
    return client.get('/api/auth/status').then((r) => r.data);
  },

  login(params: LoginParams): Promise<ApiResponse & UserInfo> {
    return client.post('/api/auth/login', params).then((r) => r.data);
  },

  logout(): Promise<ApiResponse> {
    return client.post('/api/auth/logout').then((r) => r.data);
  },
};
