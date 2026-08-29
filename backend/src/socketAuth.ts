import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './utils/database';
import { registerUserSocket, unregisterUserSocket } from './socketManager';

// Env is loaded first via server.ts's `import './loadEnv'`, so this is populated.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required — refusing to start with an insecure default');
}

export interface SocketUser {
  id: number;
  username: string;
  tenantId: number;
  currentTenantId: number;
  isSuperAdmin: boolean;
  teamIds: number[];
}

/**
 * Socket.IO auth middleware. Verifies the JWT the client sends in
 * `handshake.auth.token` (both web and mobile clients already send it), loads
 * the user, and attaches a SocketUser to `socket.data.user`. Connections
 * without a valid token for an active user in an active tenant are rejected —
 * this closes the previously-unauthenticated socket layer where any client
 * could join any room and receive chat + live GPS.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token: string | undefined =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET as string) as {
      userId: number;
      currentTenantId?: number;
    };

    const user = await db('users')
      .where({ id: decoded.userId, is_active: true })
      .first();
    if (!user) {
      return next(new Error('User not found or inactive'));
    }

    const roles = await db('user_roles').where({
      user_id: user.id,
      is_active: true,
    });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');

    // Non-super-admins are locked to their home tenant; super admins may carry a
    // selected tenant in the token (same rule as the HTTP auth middleware).
    let currentTenantId = decoded.currentTenantId || user.tenant_id;
    if (!isSuperAdmin) currentTenantId = user.tenant_id;

    const tenant = await db('tenants')
      .where({ id: currentTenantId, is_active: true })
      .first();
    if (!tenant) {
      return next(new Error('Tenant not found or inactive'));
    }

    const teams = await db('team_members')
      .where({ user_id: user.id })
      .select('team_id');

    const socketUser: SocketUser = {
      id: user.id,
      username: user.username,
      tenantId: user.tenant_id,
      currentTenantId,
      isSuperAdmin,
      teamIds: teams.map((t) => t.team_id),
    };

    socket.data.user = socketUser;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

/**
 * Wire up authenticated Socket.IO handling. The server assigns rooms from the
 * user's membership on connect — clients no longer choose their own rooms, so a
 * client can't request a channel/tenant it isn't a member of.
 */
export function setupSocket(io: SocketIOServer): void {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const u = socket.data.user as SocketUser;

    registerUserSocket(u.id, socket.id);

    // Rooms are derived server-side from membership, never from client input.
    socket.join(`tenant-${u.currentTenantId}`);
    socket.join(`tenant-${u.currentTenantId}-general-chat`);
    for (const teamId of u.teamIds) {
      socket.join(`tenant-${u.currentTenantId}-team-${teamId}`);
    }

    console.log(
      `Socket ${socket.id} authenticated: user ${u.id} (${u.username}), ` +
        `tenant ${u.currentTenantId}, teams [${u.teamIds.join(',')}]`
    );

    socket.on('disconnect', () => {
      unregisterUserSocket(u.id, socket.id);
    });
  });
}
