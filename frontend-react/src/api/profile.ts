import client from './client';
import type { Profile, ApiResponse } from '../types';

export const profileApi = {
  get(): Promise<Profile> {
    return client.get('/api/profile').then((r) => r.data);
  },

  update(displayName: string): Promise<ApiResponse & { display_name: string }> {
    return client.put('/api/profile', { display_name: displayName }).then((r) => r.data);
  },

  changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse> {
    return client.put('/api/profile/password', { old_password: oldPassword, new_password: newPassword }).then((r) => r.data);
  },
};
