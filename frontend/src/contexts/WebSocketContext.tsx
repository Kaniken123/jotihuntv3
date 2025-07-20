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
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        console.log('Disconnected from WebSocket');
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
        // Don't crash the app on WebSocket errors
      });

      newSocket.on('error', (error) => {
        console.error('WebSocket error:', error);
        // Don't crash the app on WebSocket errors
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    }
  }, [state.isAuthenticated, state.token]);

  // Separate effect for team joining to avoid reconnection loops
  useEffect(() => {
    if (socket && isConnected && state.team) {
      try {
        socket.emit('join-team', state.team.id);
      } catch (error) {
        console.error('Error joining team:', error);
        // Don't crash the app if team join fails
      }
    }
  }, [socket, isConnected, state.team?.id]);

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