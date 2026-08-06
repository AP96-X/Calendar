import axios, { AxiosError } from 'axios';
import { message } from 'antd';

const client = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30000,
});

// Request interceptor: nothing special needed (cookie-based auth)
client.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; code?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        // Redirect to login page
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      } else if (status === 403) {
        message.error(data?.error || '无权限操作');
      } else if (status >= 500) {
        message.error('服务器错误，请稍后重试');
      } else if (data?.error) {
        message.error(data.error);
      }
    } else if (error.request) {
      message.error('网络连接失败，请检查网络');
    }
    return Promise.reject(error);
  }
);

export default client;
