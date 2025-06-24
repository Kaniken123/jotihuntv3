import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { state } = useAuth();

  useEffect(() => {
    if (state.isAuthenticated && state.token) {
      const newSocket = io('http://localhost:3001', {
        auth: {
          token: state.token
        }
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('Connected to WebSocket');
        
        // Join user's team room if they have a team
        if (state.team) {
          newSocket.emit('join-team', state.team.id);
        }
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        console.log('Disconnected from WebSocket');
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    }
  }, [state.isAuthenticated, state.token, state.team]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};