import dotenv from 'dotenv';
import path from 'path';

// Load backend/.env explicitly, BEFORE any other module is imported.
//
// Two bugs this fixes:
//  1. Import order — route modules (auth.ts, middleware/auth.ts) read
//     process.env.JWT_SECRET at *import* time. ES imports are hoisted, so a
//     `dotenv.config()` call lower in server.ts runs too late. Importing this
//     file as the very first import in server.ts guarantees env is populated
//     before those modules are evaluated.
//  2. Working directory — a bare dotenv.config() resolves .env against
//     process.cwd(), which in production is the repo root (pm2 starts the app
//     from /var/www/jotihunt), not backend/. Resolving against __dirname pins
//     it to backend/.env regardless of where the process was launched.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
