import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

export const setSocketIO = (socketInstance: SocketIOServer) => {
  io = socketInstance;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};