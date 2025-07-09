"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = await (0, database_1.db)('users')
            .where({ username, is_active: true })
            .first();
        if (!user || !await bcryptjs_1.default.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        await (0, database_1.db)('auth_tokens').insert({
            user_id: user.id,
            token,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        const { password_hash, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, first_name, last_name } = req.body;
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
            role: 'user',
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
        res.status(201).json({ user });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await (0, database_1.db)('users')
            .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
            .where({ id: req.user.id })
            .first();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const teamMembership = await (0, database_1.db)('team_members')
            .join('teams', 'team_members.team_id', 'teams.id')
            .select('teams.*', 'team_members.role as member_role')
            .where('team_members.user_id', user.id)
            .first();
        res.json({ user, team: teamMembership });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});
router.post('/logout', auth_1.authenticateToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            await (0, database_1.db)('auth_tokens')
                .where({ token })
                .update({ is_revoked: true });
        }
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map