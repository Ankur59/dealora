import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false
});
