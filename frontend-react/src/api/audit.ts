import client from './client';
import type { AuditLog, LoginLog } from '../types';

export const auditApi = {
  getAuditLog(): Promise<AuditLog[]> {
    return client.get('/api/audit-log').then((r) => r.data);
  },

  getLoginLog(): Promise<LoginLog[]> {
    return client.get('/api/logins').then((r) => r.data);
  },
};
