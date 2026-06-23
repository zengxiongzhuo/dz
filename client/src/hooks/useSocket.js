// useSocket.js - Socket.IO 客户端 Hook
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// 后端默认监听地址（可通过 vite env 覆盖）
const DEFAULT_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL) ||
  (typeof window !== 'undefined' && window.location.origin) ||
  'http://localhost:3001';

export default function useSocket(url = DEFAULT_URL) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    });

    const onConnect = () => {
      console.log('[socket] connected', s.id);
      setConnected(true);
    };
    const onDisconnect = (reason) => {
      console.log('[socket] disconnected', reason);
      setConnected(false);
    };
    const onError = (err) => console.warn('[socket] error', err?.message || err);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);

    setSocket(s);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
      s.disconnect();
    };
  }, [url]);

  return { socket, connected };
}
