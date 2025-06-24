import express from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../utils/database';
import { authenticateToken } from '../middleware/auth';
import { getSocketIO } from '../socketManager';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/chat'));
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

    if (!membership && req.user!.role !== 'admin') {
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

    const [messageId] = await db('team_messages')
      .insert(messageData)
      .returning('id');

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
    if (existingMessage.user_id !== req.user!.id && req.user!.role !== 'admin') {
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

export default router;