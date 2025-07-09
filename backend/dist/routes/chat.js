"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const socketManager_1 = require("../socketManager");
const router = express_1.default.Router();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, '../../uploads/chat'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    }
});
// Get team messages
router.get('/messages/:team_id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { team_id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        // Check if user is member of the team
        const membership = await (0, database_1.db)('team_members')
            .where({ user_id: req.user.id, team_id })
            .first();
        if (!membership && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const messages = await (0, database_1.db)('team_messages')
            .select('team_messages.*', 'users.username', 'users.first_name', 'users.last_name')
            .join('users', 'team_messages.user_id', 'users.id')
            .where('team_messages.team_id', team_id)
            .orderBy('team_messages.created_at', 'desc')
            .limit(parseInt(limit))
            .offset(parseInt(offset));
        res.json(messages.reverse()); // Return in chronological order
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});
// Send a message
router.post('/messages/:team_id', auth_1.authenticateToken, upload.single('attachment'), async (req, res) => {
    try {
        const { team_id } = req.params;
        const { message } = req.body;
        if (!message && !req.file) {
            return res.status(400).json({ error: 'Message or attachment required' });
        }
        // Check if user is member of the team
        const membership = await (0, database_1.db)('team_members')
            .where({ user_id: req.user.id, team_id })
            .first();
        if (!membership) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const messageData = {
            team_id: parseInt(team_id),
            user_id: req.user.id,
            message: message || '',
        };
        if (req.file) {
            messageData.attachment_url = `/uploads/chat/${req.file.filename}`;
            messageData.attachment_type = req.file.mimetype.split('/')[0]; // image, application, etc.
        }
        const [messageId] = await (0, database_1.db)('team_messages')
            .insert(messageData)
            .returning('id');
        // Get the full message with user info
        const fullMessage = await (0, database_1.db)('team_messages')
            .select('team_messages.*', 'users.username', 'users.first_name', 'users.last_name')
            .join('users', 'team_messages.user_id', 'users.id')
            .where('team_messages.id', messageId)
            .first();
        // Emit to team members via Socket.IO
        const io = (0, socketManager_1.getSocketIO)();
        io.to(`team-${team_id}`).emit('new-message', fullMessage);
        res.status(201).json(fullMessage);
    }
    catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
// Edit a message
router.put('/messages/:message_id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { message_id } = req.params;
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message content required' });
        }
        // Check if user owns the message
        const existingMessage = await (0, database_1.db)('team_messages')
            .where({ id: message_id, user_id: req.user.id })
            .first();
        if (!existingMessage) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }
        await (0, database_1.db)('team_messages')
            .where('id', message_id)
            .update({
            message,
            is_edited: true,
            edited_at: new Date(),
        });
        // Get updated message with user info
        const updatedMessage = await (0, database_1.db)('team_messages')
            .select('team_messages.*', 'users.username', 'users.first_name', 'users.last_name')
            .join('users', 'team_messages.user_id', 'users.id')
            .where('team_messages.id', message_id)
            .first();
        // Emit update to team members
        const io = (0, socketManager_1.getSocketIO)();
        io.to(`team-${existingMessage.team_id}`).emit('message-updated', updatedMessage);
        res.json(updatedMessage);
    }
    catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Failed to edit message' });
    }
});
// Delete a message
router.delete('/messages/:message_id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { message_id } = req.params;
        const existingMessage = await (0, database_1.db)('team_messages')
            .where({ id: message_id })
            .first();
        if (!existingMessage) {
            return res.status(404).json({ error: 'Message not found' });
        }
        // Check if user owns the message or is admin
        if (existingMessage.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        await (0, database_1.db)('team_messages').where('id', message_id).del();
        // Emit deletion to team members
        const io = (0, socketManager_1.getSocketIO)();
        io.to(`team-${existingMessage.team_id}`).emit('message-deleted', { id: message_id });
        res.json({ message: 'Message deleted successfully' });
    }
    catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map