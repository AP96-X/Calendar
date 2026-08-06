import client from './client';
import type { User, ApiResponse } from '../types';

export const usersApi = {
  list(): Promise<User[]> {
    return client.get('/api/users').then((r) => r.data);
  },

  create(data: { username: string; password: string; display_name: string; role: string }): Promise<ApiResponse & { id: number }> {
    return client.post('/api/users', data).then((r) => r.data);
  },

  update(id: number, data: Partial<Pick<User, 'role' | 'enabled' | 'display_name'>>): Promise<ApiResponse> {
    return client.put(`/api/users/${id}`, data).then((r) => r.data);
  },

  resetPassword(id: number, newPassword: string): Promise<ApiResponse> {
    return client.post(`/api/users/${id}/reset-password`, { new_password: newPassword }).then((r) => r.data);
  },

  delete(id: number): Promise<ApiResponse> {
    return client.delete(`/api/users/${id}`).then((r) => r.data);
  },
};
