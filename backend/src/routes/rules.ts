import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get game rules
router.get('/spelregels', authenticateToken, async (req, res) => {
  try {
    const rulesPath = path.join(__dirname, '../../../spelregels.txt');
    
    if (!fs.existsSync(rulesPath)) {
      return res.status(404).json({ error: 'Rules file not found' });
    }

    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    
    res.json({
      content: rulesContent,
      last_updated: fs.statSync(rulesPath).mtime,
      version: '2024'
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: 'Failed to get rules' });
  }
});

// Get rules summary/highlights
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const summary = {
      event_dates: {
        start: '2024-10-19T11:00:00',
        end: '2024-10-20T13:00:00',
        halftime: '2024-10-20T00:00:00'
      },
      key_rules: [
        'Veiligheid gaat voor alles',
        'Reflecterend hesje verplicht tussen zonsondergang en zonsopgang',
        'Maximaal 4 vossenteams per speelhelft',
        'Hunt codes binnen 30 minuten insturen',
        '1 uur wachttijd na hunt op hetzelfde vossenteam',
        'Niet hunten binnen 500m van scoutinggroep'
      ],
      points: {
        own_fox_team: 6,
        other_fox_teams: 3,
        hints: 1,
        tegenhunt_start: -10,
        tegenhunt_success: 20
      },
      contact: {
        website: 'www.jotihunt.nl',
        emergency_only: true
      }
    };

    res.json(summary);
  } catch (error) {
    console.error('Get rules summary error:', error);
    res.status(500).json({ error: 'Failed to get rules summary' });
  }
});

export default router;