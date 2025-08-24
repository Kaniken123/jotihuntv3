# Jotihunt V2

A sophisticated location-based scouting game application where teams compete to find and "hunt" other teams called "foxes" across geographic areas.

## Features

- **Real-time location tracking** with GPS integration
- **Interactive mapping** with Leaflet integration
- **Team-based gameplay** with 8 game areas (Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel)
- **Hunt submission system** with photo verification
- **Team communication** with real-time chat
- **Admin dashboard** for game management
- **Progressive Web App** capabilities
- **Responsive design** optimized for mobile devices

## Tech Stack

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **SQLite** database with Knex.js ORM
- **Socket.io** for real-time communication
- **JWT** authentication
- **Bcrypt** for password hashing

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **React Leaflet** for maps
- **Socket.io Client** for real-time features
- **Axios** for API calls

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jotihuntv2
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your settings
```

4. Initialize the database:
```bash
cd backend
npm run db:migrate
npm run db:seed
```

5. Start the development servers:
```bash
npm run dev
```

This will start:
- Backend API server on http://localhost:3001
- Frontend development server on http://localhost:3000

### Demo Credentials

- **Admin**: `admin` / `admin123`
- **User**: `hunter1` / `password123`

## Game Areas

The game is divided into 8 areas:
- **Alpha** - Primary hunting zone
- **Bravo** - Secondary hunting zone  
- **Charlie** - Tertiary hunting zone
- **Delta** - Quaternary hunting zone
- **Echo** - Quinary hunting zone
- **Foxtrot** - Senary hunting zone
- **Golf** - Seventh hunting zone
- **Hotel** - Eighth hunting zone

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Game Data
- `GET /api/jotihunt/areas` - Get fox team areas
- `GET /api/jotihunt/articles` - Get game messages
- `GET /api/jotihunt/subscriptions` - Get participating teams
- `GET /api/jotihunt/status` - Get API status
- `POST /api/jotihunt/sync` - Manual sync

### Location Tracking
- `GET/POST /api/locations/settings` - Location settings
- `POST /api/locations/update` - Update user location
- `GET /api/locations/latest` - Get latest locations
- `GET /api/locations/history/:user_id` - Location history

### User Management
- `GET /api/users/users` - List users (admin)
- `GET/POST/PUT/DELETE /api/users/:id` - User CRUD
- `POST /api/users/:id/change-password` - Change password

## Database Schema

### Core Tables
- `users` - User accounts and authentication
- `teams` - Team organization
- `team_members` - User-team relationships
- `areas` - Fox teams and locations
- `articles` - Game messages (hints, assignments, news)
- `user_locations` - GPS tracking data
- `team_messages` - Team communication
- `hunts` - Hunt submissions with photos

## Development

### Backend Development
```bash
cd backend
npm run dev  # Start with nodemon
npm run build  # Build TypeScript
npm run db:migrate  # Run migrations
npm run db:seed  # Seed database
```

### Frontend Development
```bash
cd frontend
npm run dev  # Start Vite dev server
npm run build  # Build for production
npm run preview  # Preview production build
```

### Database Management
```bash
cd backend
npm run db:migrate  # Run latest migrations
npm run db:rollback  # Rollback last migration
npm run db:seed  # Run seeds
```

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables:
```bash
NODE_ENV=production
JWT_SECRET=<strong-secret-key>
PORT=3001
```

3. Start the production server:
```bash
npm start
```

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- CORS protection
- Helmet security headers
- Input validation
- SQL injection prevention
- XSS protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.