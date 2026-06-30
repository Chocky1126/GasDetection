import { http } from './http';

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function getOverview() {
  return http.get('/monitor/overview');
}

export function getSnapshots(params = {}) {
  return http.get('/monitor/snapshots', { params });
}

export function getAlarms(params = {}) {
  return http.get('/alarms', { params });
}

export function getAlarm(id: string) {
  return http.get(`/alarms/${id}`);
}

export function getAlarmStatistics() {
  return http.get('/alarms/statistics');
}

export function ackAlarm(id: string, data: { remark?: string } = {}) {
  return http.patch(`/alarms/${id}/ack`, data);
}

export function resolveAlarm(id: string, data: { remark?: string } = {}) {
  return http.patch(`/alarms/${id}/resolve`, data);
}

export function listResource<T>(endpoint: string, params = {}) {
  return http.get<ListResult<T>>(endpoint, { params });
}

export function createResource<T>(endpoint: string, data: T) {
  return http.post(endpoint, data);
}

export function updateResource<T>(endpoint: string, id: string, data: T) {
  return http.patch(`${endpoint}/${id}`, data);
}

export function deleteResource(endpoint: string, id: string) {
  return http.delete(`${endpoint}/${id}`);
}
