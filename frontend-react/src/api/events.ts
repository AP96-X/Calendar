import client from './client';
import type { CalendarEvent, EventInput, EventsByDate, ApiResponse } from '../types';

/** Convert a flat event array to a date-keyed map */
function toEventsByDate(events: CalendarEvent[]): EventsByDate {
  const map: EventsByDate = {};
  for (const e of events) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return map;
}

export const eventsApi = {
  getMonthEvents(year: number, month: number): Promise<EventsByDate> {
    return client
      .get<CalendarEvent[]>('/api/events', { params: { year, month } })
      .then((r) => toEventsByDate(r.data));
  },

  getWeekEvents(date: string): Promise<EventsByDate> {
    return client
      .get<CalendarEvent[]>('/api/events/week', { params: { date } })
      .then((r) => toEventsByDate(r.data));
  },

  getDayEvents(date: string): Promise<CalendarEvent[]> {
    return client.get('/api/events/day', { params: { date } }).then((r) => r.data);
  },

  create(data: EventInput): Promise<CalendarEvent & ApiResponse> {
    return client.post('/api/events', data).then((r) => r.data);
  },

  update(id: number, data: Partial<EventInput>): Promise<ApiResponse> {
    return client.put(`/api/events/${id}`, data).then((r) => r.data);
  },

  toggle(id: number): Promise<{ completed: boolean }> {
    return client.post(`/api/events/${id}/toggle`).then((r) => r.data);
  },

  delete(id: number): Promise<ApiResponse> {
    return client.delete(`/api/events/${id}`).then((r) => r.data);
  },

  exportExcel(year: number, month: number): string {
    return `/api/events/export?year=${year}&month=${month}`;
  },

  exportYearUrl(year: number): string {
    return `/api/events/export?year=${year}`;
  },

  exportAllUrl(): string {
    return `/api/events/export?all=1`;
  },

  getAvailableYears(): Promise<{ years: number[] }> {
    return client.get('/api/events/years').then((r) => r.data);
  },

  importExcel(file: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return client
      .post('/api/events/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getTemplateUrl(): string {
    return '/api/events/template';
  },
};
