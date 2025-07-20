"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/users', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const users = await (0, database_1.db)('users')
            .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
            .orderBy('username');
        const usersWithTeams = await Promise.all(users.map(async (user) => {
            const teamMembership = await (0, database_1.db)('team_members')
                .join('teams', 'team_members.team_id', 'teams.id')
                .select('teams.name', 'teams.area', 'team_members.role')
                .where('team_members.user_id', user.id)
                .first();
            return {
                ...user,
                team: teamMembership
            };
        }));
        res.json(usersWithTeams);
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
router.get('/users/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const user = await (0, database_1.db)('users')
            .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
            .where('id', id)
            .first();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const teamMembership = await (0, database_1.db)('team_members')
            .join('teams', 'team_members.team_id', 'teams.id')
            .select('teams.*', 'team_members.role as member_role')
            .where('team_members.user_id', id)
            .first();
        res.json({ ...user, team: teamMembership });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
router.post('/users', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role, team_id } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password required' });
        }
        const existingUser = await (0, database_1.db)('users')
            .where('username', username)
            .orWhere('email', email)
            .first();
        if (existingUser) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        const password_hash = await bcryptjs_1.default.hash(password, 10);
        // Insert user
        await (0, database_1.db)('users').insert({
            username,
            email,
            password_hash,
            first_name,
            last_name,
            role: role || 'user',
            is_active: true
        });
        // Get the newly created user
        const user = await (0, database_1.db)('users')
            .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
            .where('username', username)
            .first();
        if (!user) {
            throw new Error('Failed to create user');
        }
        if (team_id) {
            await (0, database_1.db)('team_members').insert({
                user_id: user.id,
                team_id,
                role: 'member'
            });
        }
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});
router.put('/users/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, first_name, last_name, role, team_id, is_active } = req.body;
        if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const updateData = { updated_at: new Date() };
        if (username)
            updateData.username = username;
        if (email)
            updateData.email = email;
        if (first_name)
            updateData.first_name = first_name;
        if (last_name)
            updateData.last_name = last_name;
        if (role && req.user.role === 'admin')
            updateData.role = role;
        if (typeof is_active === 'boolean' && req.user.role === 'admin')
            updateData.is_active = is_active;
        await (0, database_1.db)('users').where('id', id).update(updateData);
        // Handle team assignment if admin is making the request
        if (req.user.role === 'admin' && team_id !== undefined) {
            // Remove existing team membership
            await (0, database_1.db)('team_members').where('user_id', id).del();
            // Add new team membership if team_id is provided
            if (team_id) {
                await (0, database_1.db)('team_members').insert({
                    user_id: parseInt(id),
                    team_id: parseInt(team_id),
                    role: 'member'
                });
            }
        }
        const user = await (0, database_1.db)('users')
            .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
            .where('id', id)
            .first();
        res.json(user);
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});
router.delete('/users/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Safety check: Only allow deletion of inactive users
        const user = await (0, database_1.db)('users').where('id', id).first();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.is_active) {
            return res.status(400).json({
                error: 'Cannot delete active user. Please deactivate the user first.'
            });
        }
        // Prevent deletion of admin users for safety
        if (user.role === 'admin') {
            return res.status(400).json({
                error: 'Cannot delete admin users for security reasons.'
            });
        }
        // Delete user and related data in transaction
        await database_1.db.transaction(async (trx) => {
            // Remove team memberships
            await trx('team_members').where('user_id', id).del();
            // Remove auth tokens
            await trx('auth_tokens').where('user_id', id).del();
            // Remove location data
            await trx('user_locations').where('user_id', id).del();
            // Remove location settings
            await trx('location_settings').where('user_id', id).del();
            // Remove article reads
            await trx('user_article_reads').where('user_id', id).del();
            // Remove assignment completions
            await trx('user_assignment_completions').where('user_id', id).del();
            // Finally delete the user
            await trx('users').where('id', id).del();
        });
        res.json({ message: 'User permanently deleted successfully' });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
router.post('/users/:id/change-password', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { current_password, new_password } = req.body;
        if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (!new_password) {
            return res.status(400).json({ error: 'New password required' });
        }
        const user = await (0, database_1.db)('users').where('id', id).first();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (req.user.role !== 'admin' && !await bcryptjs_1.default.compare(current_password, user.password_hash)) {
            return res.status(401).json({ error: 'Current password incorrect' });
        }
        const password_hash = await bcryptjs_1.default.hash(new_password, 10);
        await (0, database_1.db)('users').where('id', id).update({ password_hash, updated_at: new Date() });
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map