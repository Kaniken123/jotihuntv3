import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, extractInsertId } from '../utils/database';
import { authenticateToken, isAdmin, enforceTenantIsolation } from '../middleware/auth';
import { getSocketIO } from '../socketManager';

const router = express.Router();

// Ensure the chat upload dir exists at startup — multer's diskStorage throws
// ENOENT on first use otherwise (which was silently breaking attachment sends).
const chatUploadsDir = path.join(__dirname, '../../uploads/chat');
fs.mkdirSync(chatUploadsDir, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get team messages
router.get('/messages/:team_id', authenticateToken, async (req, res) => {
  try {
    const { team_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Check if user is member of the team
    const membership = await db('team_members')
      .where({ user_id: req.user!.id, team_id })
      .first();

    if (!membership && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await db('team_messages')
      .select(
        'team_messages.*',
        'users.username',
        'users.first_name',
        'users.last_name'
      )
      .join('users', 'team_messages.user_id', 'users.id')
      .where('team_messages.team_id', team_id)
      .orderBy('team_messages.created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json(messages.reverse()); // Return in chronological order
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send a message
router.post('/messages/:team_id', authenticateToken, upload.single('attachment'), async (req, res) => {
  try {
    const { team_id } = req.params;
    const { message } = req.body;

    if (!message && !req.file) {
      return res.status(400).json({ error: 'Message or attachment required' });
    }

    // Check if user is member of the team
    const membership = await db('team_members')
      .where({ user_id: req.user!.id, team_id })
      .first();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageData: any = {
      team_id: parseInt(team_id),
      user_id: req.user!.id,
      message: message || '',
    };

    if (req.file) {
      messageData.attachment_url = `/uploads/chat/${req.file.filename}`;
      messageData.attachment_type = req.file.mimetype.split('/')[0]; // image, application, etc.
    }

    const messageId = extractInsertId(
      await db('team_messages').insert(messageData).returning('id')
    );

    // Get the full message with user info
    const fullMessage = await db('team_messages')
      .select(
        'team_messages.*',
        'users.username',
        'users.first_name',
        'users.last_name'
      )
      .join('users', 'team_messages.user_id', 'users.id')
      .where('team_messages.id', messageId)
      .first();

    // Emit to team members via Socket.IO
    const io = getSocketIO();
    io.to(`team-${team_id}`).emit('new-message', fullMessage);

    res.status(201).json(fullMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit a message
router.put('/messages/:message_id', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Check if user owns the message
    const existingMessage = await db('team_messages')
      .where({ id: message_id, user_id: req.user!.id })
      .first();

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    await db('team_messages')
      .where('id', message_id)
      .update({
        message,
        is_edited: true,
        edited_at: new Date(),
      });

    // Get updated message with user info
    const updatedMessage = await db('team_messages')
      .select(
        'team_messages.*',
        'users.username',
        'users.first_name',
        'users.last_name'
      )
      .join('users', 'team_messages.user_id', 'users.id')
      .where('team_messages.id', message_id)
      .first();

    // Emit update to team members
    const io = getSocketIO();
    io.to(`team-${existingMessage.team_id}`).emit('message-updated', updatedMessage);

    res.json(updatedMessage);
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete a message
router.delete('/messages/:message_id', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;

    const existingMessage = await db('team_messages')
      .where({ id: message_id })
      .first();

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user owns the message or is admin
    if (existingMessage.user_id !== req.user!.id && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db('team_messages').where('id', message_id).del();

    // Emit deletion to team members
    const io = getSocketIO();
    io.to(`team-${existingMessage.team_id}`).emit('message-deleted', { id: message_id });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get available channels for user
router.get('/channels', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;
    
    const channels = await db('chat_channels')
      .select('*')
      .where('tenant_id', tenantId)
      .where(function() {
        this.where('type', 'general')
          .orWhere(function() {
            this.where('type', 'team')
              .whereIn('team_id', function() {
                this.select('team_id')
                  .from('team_members')
                  .where('user_id', req.user!.id);
              });
          });
      })
      .where('is_active', true)
      .orderBy('type', 'desc') // general first, then team
      .orderBy('name');

    res.json(channels);
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// Get channel messages
router.get('/channels/:channel_id/messages', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { channel_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;

    // Check channel access with tenant isolation
    const channel = await db('chat_channels')
      .where('id', channel_id)
      .where('tenant_id', tenantId)
      .first();
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check access permissions
    if (channel.type === 'team') {
      const membership = await db('team_members')
        .where({ user_id: req.user!.id, team_id: channel.team_id })
        .first();
      
      if (!membership && !isAdmin(req.user!)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const messages = await db('team_messages')
      .select(
        'team_messages.*',
        'users.username',
        'users.first_name',
        'users.last_name'
      )
      .join('users', 'team_messages.user_id', 'users.id')
      .where('team_messages.channel_id', channel_id)
      .where('team_messages.tenant_id', tenantId)
      .orderBy('team_messages.created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get reactions for these messages
    const messageIds = messages.map(m => m.id);
    const reactions = await db('message_reactions')
      .select('message_id', 'emoji', 'user_id')
      .whereIn('message_id', messageIds);

    // Group reactions by message
    const messageReactions: { [key: number]: any[] } = {};
    reactions.forEach(r => {
      if (!messageReactions[r.message_id]) {
        messageReactions[r.message_id] = [];
      }
      messageReactions[r.message_id].push(r);
    });

    // Add reactions to messages
    const messagesWithReactions = messages.map(msg => ({
      ...msg,
      reactions: messageReactions[msg.id] || []
    }));

    res.json(messagesWithReactions.reverse()); // Return in chronological order
  } catch (error) {
    console.error('Get channel messages error:', error);
    res.status(500).json({ error: 'Failed to get channel messages' });
  }
});

// Send message to channel
router.post('/channels/:channel_id/messages', authenticateToken, enforceTenantIsolation, upload.single('attachment'), async (req, res) => {
  try {
    const { channel_id } = req.params;
    const { message } = req.body;
    const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;

    if (!message && !req.file) {
      return res.status(400).json({ error: 'Message or attachment required' });
    }

    // Check channel access with tenant isolation
    const channel = await db('chat_channels')
      .where('id', channel_id)
      .where('tenant_id', tenantId)
      .first();
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check permissions
    if (channel.type === 'team') {
      const membership = await db('team_members')
        .where({ user_id: req.user!.id, team_id: channel.team_id })
        .first();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const messageData: any = {
      team_id: channel.team_id, // null for general channels
      channel_id: parseInt(channel_id),
      user_id: req.user!.id,
      tenant_id: tenantId,
      message: message || '',
      status: 'sent'
    };

    if (req.file) {
      messageData.attachment_url = `/uploads/chat/${req.file.filename}`;
      messageData.attachment_type = req.file.mimetype.split('/')[0];
    }

    const messageId = extractInsertId(
      await db('team_messages').insert(messageData).returning('id')
    );

    // Get the full message with user info
    const fullMessage = await db('team_messages')
      .select(
        'team_messages.*',
        'users.username',
        'users.first_name',
        'users.last_name'
      )
      .join('users', 'team_messages.user_id', 'users.id')
      .where('team_messages.id', messageId)
      .first();

    // Emit to appropriate tenant-specific room
    const io = getSocketIO();
    const roomName = channel.type === 'general' ? `tenant-${tenantId}-general-chat` : `tenant-${tenantId}-team-${channel.team_id}`;
    io.to(roomName).emit('new-message', fullMessage);

    res.status(201).json(fullMessage);
  } catch (error) {
    console.error('Send channel message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Add reaction to message
router.post('/messages/:message_id/reactions', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji required' });
    }

    // Check if message exists and user has access
    const message = await db('team_messages')
      .select('team_messages.*', 'chat_channels.type', 'chat_channels.team_id')
      .leftJoin('chat_channels', 'team_messages.channel_id', 'chat_channels.id')
      .where('team_messages.id', message_id)
      .first();

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check access for team channels
    if (message.type === 'team') {
      const membership = await db('team_members')
        .where({ user_id: req.user!.id, team_id: message.team_id })
        .first();
      
      if (!membership && !isAdmin(req.user!)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Insert or update reaction (upsert)
    await db('message_reactions')
      .insert({
        message_id: parseInt(message_id),
        user_id: req.user!.id,
        emoji
      })
      .onConflict(['message_id', 'user_id', 'emoji'])
      .ignore();

    // Get all reactions for this message
    const reactions = await db('message_reactions')
      .select('emoji', 'user_id')
      .where('message_id', message_id);

    // Emit reaction update with tenant-specific room
    const io = getSocketIO();
    const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;
    const roomName = message.type === 'general' ? `tenant-${tenantId}-general-chat` : `tenant-${tenantId}-team-${message.team_id}`;
    io.to(roomName).emit('message-reaction-added', {
      message_id: parseInt(message_id),
      reactions
    });

    res.json({ message: 'Reaction added', reactions });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from message
router.delete('/messages/:message_id/reactions/:emoji', authenticateToken, async (req, res) => {
  try {
    const { message_id, emoji } = req.params;

    await db('message_reactions')
      .where({
        message_id: parseInt(message_id),
        user_id: req.user!.id,
        emoji: decodeURIComponent(emoji)
      })
      .del();

    // Get updated reactions
    const reactions = await db('message_reactions')
      .select('emoji', 'user_id')
      .where('message_id', message_id);

    // Get message info for room detection
    const message = await db('team_messages')
      .select('team_messages.*', 'chat_channels.type', 'chat_channels.team_id')
      .leftJoin('chat_channels', 'team_messages.channel_id', 'chat_channels.id')
      .where('team_messages.id', message_id)
      .first();

    // Emit reaction update with tenant-specific room
    const io = getSocketIO();
    const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;
    const roomName = message.type === 'general' ? `tenant-${tenantId}-general-chat` : `tenant-${tenantId}-team-${message.team_id}`;
    io.to(roomName).emit('message-reaction-removed', {
      message_id: parseInt(message_id),
      reactions
    });

    res.json({ message: 'Reaction removed', reactions });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

export default router;