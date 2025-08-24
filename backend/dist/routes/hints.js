"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const coordinates_1 = require("../utils/coordinates");
const router = express_1.default.Router();
// Submit a hint solution
router.post('/solutions', auth_1.authenticateToken, async (req, res) => {
    try {
        const { article_id, solution, fox_coordinates } = req.body;
        const user_id = req.user.id;
        // Validate required fields
        if (!article_id || !solution) {
            return res.status(400).json({ error: 'Article ID and solution are required' });
        }
        // Get user's team
        const teamMember = await (0, database_1.db)('team_members')
            .where('user_id', user_id)
            .first();
        if (!teamMember) {
            return res.status(400).json({ error: 'User must be part of a team to submit solutions' });
        }
        // Check if article exists and is accessible
        const article = await (0, database_1.db)('articles')
            .where('id', article_id)
            .first();
        if (!article) {
            return res.status(404).json({ error: 'Hint not found' });
        }
        // Check if team already submitted solution for this hint
        const existingSolution = await (0, database_1.db)('hint_solutions')
            .where('team_id', teamMember.team_id)
            .where('article_id', article_id)
            .first();
        if (existingSolution) {
            return res.status(409).json({ error: 'Team has already submitted a solution for this hint' });
        }
        // Process fox coordinates for each area
        const coordinateData = {};
        const revealedAreas = [];
        if (fox_coordinates) {
            const areas = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
            for (const area of areas) {
                const areaCoords = fox_coordinates[area];
                if (areaCoords && areaCoords.rd_x && areaCoords.rd_y) {
                    // Validate coordinates
                    const parsed = { x: parseFloat(areaCoords.rd_x), y: parseFloat(areaCoords.rd_y) };
                    if (!(0, coordinates_1.validateRDCoordinates)(parsed)) {
                        return res.status(400).json({
                            error: `Invalid Rijksdriehoek coordinates for ${area}. X should be 10000-280000, Y should be 300000-620000`
                        });
                    }
                    // Store RD coordinates
                    coordinateData[`${area}_rd_x`] = parsed.x;
                    coordinateData[`${area}_rd_y`] = parsed.y;
                    // Convert to WGS84
                    const wgs84 = (0, coordinates_1.rdToWgs84)(parsed);
                    coordinateData[`${area}_lat`] = wgs84.lat;
                    coordinateData[`${area}_lng`] = wgs84.lng;
                    revealedAreas.push(area.charAt(0).toUpperCase() + area.slice(1));
                }
            }
        }
        // Auto-validate simple solutions (this can be expanded with more complex validation logic)
        const is_correct = await validateSolution(article, solution);
        const reveals_fox_location = is_correct && revealedAreas.length > 0;
        // Insert solution
        const [solution_id] = await (0, database_1.db)('hint_solutions').insert({
            team_id: teamMember.team_id,
            user_id,
            article_id,
            solution,
            ...coordinateData,
            reveals_fox_areas: reveals_fox_location ? JSON.stringify(revealedAreas) : null,
            is_correct,
            reveals_fox_location
        });
        // If solution reveals fox locations, update the areas
        if (reveals_fox_location) {
            for (const areaName of revealedAreas) {
                const areaLower = areaName.toLowerCase();
                if (coordinateData[`${areaLower}_lat`] && coordinateData[`${areaLower}_lng`]) {
                    await revealFoxLocation(areaName, coordinateData[`${areaLower}_lat`], coordinateData[`${areaLower}_lng`], user_id);
                }
            }
        }
        // Get the created solution with team info
        const createdSolution = await (0, database_1.db)('hint_solutions')
            .select('hint_solutions.*', 'teams.name as team_name', 'users.username')
            .join('teams', 'hint_solutions.team_id', 'teams.id')
            .join('users', 'hint_solutions.user_id', 'users.id')
            .where('hint_solutions.id', solution_id)
            .first();
        // Emit real-time update if correct
        if (is_correct) {
            const { getSocketIO } = require('../socketManager');
            try {
                const io = getSocketIO();
                io.emit('hint-solution-submitted', {
                    solution: createdSolution,
                    reveals_fox: reveals_fox_location,
                    revealed_areas: revealedAreas
                });
            }
            catch (error) {
                console.error('Socket emission error:', error);
            }
        }
        res.status(201).json({
            success: true,
            solution: createdSolution,
            message: is_correct ?
                (reveals_fox_location ? `Correct! Revealed ${revealedAreas.join(', ')} fox locations!` : 'Correct solution!') :
                'Solution submitted for review'
        });
    }
    catch (error) {
        console.error('Submit hint solution error:', error);
        res.status(500).json({ error: 'Failed to submit solution' });
    }
});
// Get solutions for a team
router.get('/solutions', auth_1.authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.id;
        // Get user's team
        const teamMember = await (0, database_1.db)('team_members')
            .where('user_id', user_id)
            .first();
        if (!teamMember) {
            return res.status(400).json({ error: 'User must be part of a team' });
        }
        const solutions = await (0, database_1.db)('hint_solutions')
            .select('hint_solutions.*', 'articles.title as hint_title', 'articles.content as hint_body', 'users.username as submitted_by')
            .join('articles', 'hint_solutions.article_id', 'articles.id')
            .join('users', 'hint_solutions.user_id', 'users.id')
            .where('hint_solutions.team_id', teamMember.team_id)
            .orderBy('hint_solutions.created_at', 'desc');
        res.json(solutions);
    }
    catch (error) {
        console.error('Get hint solutions error:', error);
        res.status(500).json({ error: 'Failed to get solutions' });
    }
});
// Admin: Get all solutions
router.get('/solutions/all', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!(0, auth_1.isAdmin)(req.user)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const solutions = await (0, database_1.db)('hint_solutions')
            .select('hint_solutions.*', 'articles.title as hint_title', 'teams.name as team_name', 'users.username as submitted_by')
            .join('articles', 'hint_solutions.article_id', 'articles.id')
            .join('teams', 'hint_solutions.team_id', 'teams.id')
            .join('users', 'hint_solutions.user_id', 'users.id')
            .orderBy('hint_solutions.created_at', 'desc');
        res.json(solutions);
    }
    catch (error) {
        console.error('Get all hint solutions error:', error);
        res.status(500).json({ error: 'Failed to get solutions' });
    }
});
// Admin: Approve/reject a solution
router.patch('/solutions/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (!(0, auth_1.isAdmin)(req.user)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const { id } = req.params;
        const { is_correct, fox_team, reveals_fox_location } = req.body;
        const solution = await (0, database_1.db)('hint_solutions')
            .where('id', id)
            .first();
        if (!solution) {
            return res.status(404).json({ error: 'Solution not found' });
        }
        // Update solution
        await (0, database_1.db)('hint_solutions')
            .where('id', id)
            .update({
            is_correct,
            fox_team: reveals_fox_location ? fox_team : null,
            reveals_fox_location: reveals_fox_location && is_correct
        });
        // If now reveals fox location and has coordinates, update area
        if (reveals_fox_location && is_correct && fox_team && solution.lat && solution.lng) {
            await revealFoxLocation(fox_team, solution.lat, solution.lng, req.user.id);
        }
        res.json({ success: true, message: 'Solution updated successfully' });
    }
    catch (error) {
        console.error('Update hint solution error:', error);
        res.status(500).json({ error: 'Failed to update solution' });
    }
});
// Utility function to validate solution (can be expanded)
async function validateSolution(article, solution) {
    // Basic validation - in a real implementation, this could be more sophisticated
    // For now, just check if solution is not empty and has reasonable length
    return solution.trim().length >= 3;
}
// Utility function to reveal fox location
async function revealFoxLocation(foxTeam, lat, lng, userId) {
    try {
        // Find the area for this fox team
        const area = await (0, database_1.db)('areas')
            .where('name', foxTeam)
            .orWhere('fox_team_name', foxTeam)
            .first();
        if (area) {
            // Update fox location
            await (0, database_1.db)('areas')
                .where('id', area.id)
                .update({
                lat,
                lng,
                last_seen: new Date(),
                status: 'active'
            });
            // Emit real-time fox location update
            const { getSocketIO } = require('../socketManager');
            try {
                const io = getSocketIO();
                io.emit('fox-location-update', {
                    area_id: area.id,
                    fox_team: foxTeam,
                    lat,
                    lng,
                    last_seen: new Date(),
                    source: 'hint_solution'
                });
            }
            catch (error) {
                console.error('Socket emission error:', error);
            }
        }
    }
    catch (error) {
        console.error('Reveal fox location error:', error);
    }
}
exports.default = router;
//# sourceMappingURL=hints.js.map