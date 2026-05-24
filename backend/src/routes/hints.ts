import express from 'express';
import { db } from '../utils/database';
import { authenticateToken, isAdmin } from '../middleware/auth';
import { rdToWgs84, parseRDCoordinates, validateRDCoordinates, formatRDCoordinates } from '../utils/coordinates';
import { triggerPrediction } from '../services/foxPrediction';

const router = express.Router();

/** Recompute predictions for the named fox areas of a tenant (fire-and-forget). */
async function triggerForFoxNames(foxNames: string[], tenantId: number): Promise<void> {
  if (!foxNames.length) return;
  try {
    const areas = await db('areas').whereIn('name', foxNames).where('tenant_id', tenantId);
    for (const area of areas) triggerPrediction(area.id, tenantId);
  } catch (err: any) {
    console.error('Hint prediction trigger lookup failed:', err?.message ?? err);
  }
}

// Submit a hint solution. A single hint can reveal several fox areas at once, so
// we store ONE ROW PER REVEALED FOX (the table holds a single fox_team/lat/lng).
// article_id is OPTIONAL: a hint location can be reported standalone, before the
// matching API article is synced. New rows are 'unverified' until an admin
// confirms them via PATCH /solutions/:id — we never auto-confirm or auto-reveal.
router.post('/solutions', authenticateToken, async (req, res) => {
  try {
    const { article_id, solution, fox_coordinates } = req.body;
    const user_id = req.user!.id;

    if (!solution || !solution.trim()) {
      return res.status(400).json({ error: 'Solution text is required' });
    }

    // Get user's team
    const teamMember = await db('team_members')
      .where('user_id', user_id)
      .first();

    if (!teamMember) {
      return res.status(400).json({ error: 'User must be part of a team to submit solutions' });
    }

    // article_id is optional; if provided it must exist.
    if (article_id) {
      const article = await db('articles').where('id', article_id).first();
      if (!article) {
        return res.status(404).json({ error: 'Hint not found' });
      }
    }

    // Parse fox coordinates -> one entry per area that has valid RD coordinates.
    const foxRows: Array<{ fox_team: string; rd_x: number; rd_y: number; lat: number; lng: number }> = [];
    if (fox_coordinates) {
      const areas = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
      for (const area of areas) {
        const areaCoords = fox_coordinates[area];
        if (areaCoords && areaCoords.rd_x && areaCoords.rd_y) {
          const parsed = { x: parseFloat(areaCoords.rd_x), y: parseFloat(areaCoords.rd_y) };
          if (!validateRDCoordinates(parsed)) {
            return res.status(400).json({
              error: `Invalid Rijksdriehoek coordinates for ${area}. X should be 10000-280000, Y should be 300000-620000`
            });
          }
          const wgs84 = rdToWgs84(parsed);
          foxRows.push({
            fox_team: area.charAt(0).toUpperCase() + area.slice(1),
            rd_x: parsed.x,
            rd_y: parsed.y,
            lat: wgs84.lat,
            lng: wgs84.lng
          });
        }
      }
    }

    const baseRow = {
      team_id: teamMember.team_id,
      user_id,
      article_id: article_id || null,
      solution,
      verification_status: 'unverified',
      is_correct: false,
      reveals_fox_location: false
    };

    // One row per revealed fox; if no coords were given, store a single
    // text-only row so the solution is still recorded.
    const insertedIds: number[] = [];
    if (foxRows.length > 0) {
      for (const fox of foxRows) {
        const [id] = await db('hint_solutions').insert({
          ...baseRow,
          fox_team: fox.fox_team,
          rd_x: fox.rd_x,
          rd_y: fox.rd_y,
          lat: fox.lat,
          lng: fox.lng,
          reveals_fox_location: true
        });
        insertedIds.push(id);
      }
    } else {
      const [id] = await db('hint_solutions').insert(baseRow);
      insertedIds.push(id);
    }

    const createdSolutions = await db('hint_solutions')
      .select('hint_solutions.*', 'teams.name as team_name', 'users.username')
      .join('teams', 'hint_solutions.team_id', 'teams.id')
      .join('users', 'hint_solutions.user_id', 'users.id')
      .whereIn('hint_solutions.id', insertedIds);

    // Notify clients. The solution is UNVERIFIED — the map/predictor should weight
    // it low until an admin confirms it.
    try {
      const { getSocketIO } = require('../socketManager');
      getSocketIO().emit('hint-solution-submitted', {
        solutions: createdSolutions,
        verification_status: 'unverified',
        revealed_areas: foxRows.map(f => f.fox_team)
      });
    } catch (error) {
      console.error('Socket emission error:', error);
    }

    // Recompute affected foxes' predictions (unverified → low weight applies).
    const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;
    void triggerForFoxNames(foxRows.map(f => f.fox_team), tenantId);

    res.status(201).json({
      success: true,
      solution: createdSolutions[0], // backward-compat: first row
      solutions: createdSolutions,
      message: 'Solution submitted for review'
    });

  } catch (error) {
    console.error('Submit hint solution error:', error);
    res.status(500).json({ error: 'Failed to submit solution' });
  }
});

// Get solutions for a team
router.get('/solutions', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user!.id;
    
    // Get user's team
    const teamMember = await db('team_members')
      .where('user_id', user_id)
      .first();

    if (!teamMember) {
      return res.status(400).json({ error: 'User must be part of a team' });
    }

    const solutions = await db('hint_solutions')
      .select(
        'hint_solutions.*',
        'articles.title as hint_title',
        'articles.content as hint_body',
        'users.username as submitted_by'
      )
      .join('articles', 'hint_solutions.article_id', 'articles.id')
      .join('users', 'hint_solutions.user_id', 'users.id')
      .where('hint_solutions.team_id', teamMember.team_id)
      .orderBy('hint_solutions.created_at', 'desc');

    res.json(solutions);
  } catch (error) {
    console.error('Get hint solutions error:', error);
    res.status(500).json({ error: 'Failed to get solutions' });
  }
});

// Admin: Get all solutions
router.get('/solutions/all', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const solutions = await db('hint_solutions')
      .select(
        'hint_solutions.*',
        'articles.title as hint_title',
        'teams.name as team_name',
        'users.username as submitted_by'
      )
      .join('articles', 'hint_solutions.article_id', 'articles.id')
      .join('teams', 'hint_solutions.team_id', 'teams.id')
      .join('users', 'hint_solutions.user_id', 'users.id')
      .orderBy('hint_solutions.created_at', 'desc');

    res.json(solutions);
  } catch (error) {
    console.error('Get all hint solutions error:', error);
    res.status(500).json({ error: 'Failed to get solutions' });
  }
});

// Admin: Approve/reject a solution
router.patch('/solutions/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    // verification_status: 'confirmed' | 'rejected' | 'unverified'.
    // Accept legacy `is_correct` boolean too, mapping true->confirmed.
    const { verification_status, is_correct } = req.body;
    const status =
      verification_status ??
      (is_correct === true ? 'confirmed' : is_correct === false ? 'rejected' : undefined);

    if (!['confirmed', 'rejected', 'unverified'].includes(status)) {
      return res.status(400).json({ error: 'verification_status must be confirmed, rejected, or unverified' });
    }

    const solution = await db('hint_solutions')
      .where('id', id)
      .first();

    if (!solution) {
      return res.status(404).json({ error: 'Solution not found' });
    }

    await db('hint_solutions')
      .where('id', id)
      .update({
        verification_status: status,
        // keep legacy flag roughly in sync for any old readers
        is_correct: status === 'confirmed'
      });

    // On confirmation, push the (now trusted) coordinates to the fox area.
    if (status === 'confirmed' && solution.fox_team && solution.lat && solution.lng) {
      await revealFoxLocation(solution.fox_team, solution.lat, solution.lng, req.user!.id);
    }

    // Trust changed → recompute this fox's prediction at the new weight.
    if (solution.fox_team) {
      const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;
      void triggerForFoxNames([solution.fox_team], tenantId);
    }

    res.json({ success: true, message: 'Solution updated successfully', verification_status: status });
  } catch (error) {
    console.error('Update hint solution error:', error);
    res.status(500).json({ error: 'Failed to update solution' });
  }
});

// Utility function to validate solution (can be expanded)
async function validateSolution(article: any, solution: string): Promise<boolean> {
  // Basic validation - in a real implementation, this could be more sophisticated
  // For now, just check if solution is not empty and has reasonable length
  return solution.trim().length >= 3;
}

// Utility function to reveal fox location
async function revealFoxLocation(foxTeam: string, lat: number, lng: number, userId: number) {
  try {
    // Find the area for this fox team
    const area = await db('areas')
      .where('name', foxTeam)
      .orWhere('fox_team_name', foxTeam)
      .first();

    if (area) {
      // Update fox location
      await db('areas')
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
      } catch (error) {
        console.error('Socket emission error:', error);
      }
    }
  } catch (error) {
    console.error('Reveal fox location error:', error);
  }
}

export default router;