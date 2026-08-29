import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

// Per-user socket registry: userId -> set of that user's live socket ids.
// Lets us act on a user's open connections (e.g. force-disconnect on
// suspension/reassignment) instead of only blocking their next request.
const userSockets = new Map<number, Set<string>>();

export const setSocketIO = (socketInstance: SocketIOServer) => {
  io = socketInstance;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const registerUserSocket = (userId: number, socketId: string) => {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(socketId);
};

export const unregisterUserSocket = (userId: number, socketId: string) => {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
};

// Force-disconnect every live socket for a user. Used when a user is
// suspended or otherwise loses access mid-session — closing the connection
// stops position pushes and chat immediately, not just on their next request.
export const disconnectUser = (userId: number) => {
  if (!io) return;
  const set = userSockets.get(userId);
  if (!set) return;
  for (const socketId of set) {
    const s = io.sockets.sockets.get(socketId);
    if (s) s.disconnect(true);
  }
  userSockets.delete(userId);
};

export const getUserSocketCount = (userId: number): number => {
  return userSockets.get(userId)?.size ?? 0;
};
