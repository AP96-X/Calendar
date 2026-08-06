import client from './client';
import type { CalendarMeta, MetaStatus, ApiResponse } from '../types';

export const calendarApi = {
  getMeta(year: number, month: number): Promise<CalendarMeta> {
    return client.get('/api/calendar-meta', { params: { year, month } }).then((r) => r.data);
  },

  refresh(year: number, month: number): Promise<ApiResponse> {
    return client.post('/api/calendar-meta/refresh', { year, month }).then((r) => r.data);
  },

  getStatus(year: number, month: number): Promise<MetaStatus> {
    return client.get('/api/calendar-meta/status', { params: { year, month } }).then((r) => r.data);
  },
};
