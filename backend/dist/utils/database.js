"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = exports.db = void 0;
const knex_1 = __importDefault(require("knex"));
const path_1 = __importDefault(require("path"));
const knexConfig = {
    client: 'sqlite3',
    connection: {
        filename: path_1.default.join(__dirname, '../../database/jotihunt.db')
    },
    migrations: {
        directory: path_1.default.join(__dirname, '../../database/migrations')
    },
    seeds: {
        directory: path_1.default.join(__dirname, '../../database/seeds')
    },
    // SQLite is single-writer: more than one connection to the same file causes
    // SQLITE_BUSY under concurrent writes. Use a single connection and let queries
    // serialize through it. busy_timeout makes any remaining lock wait instead of
    // failing instantly; WAL mode allows reads to proceed during a write.
    pool: {
        min: 1,
        max: 1,
        afterCreate: (conn, done) => {
            conn.run('PRAGMA busy_timeout = 10000', (err) => {
                if (err)
                    return done(err, conn);
                conn.run('PRAGMA journal_mode = WAL', (err2) => {
                    done(err2, conn);
                });
            });
        }
    },
    acquireConnectionTimeout: 30000,
    useNullAsDefault: true
};
exports.db = (0, knex_1.default)(knexConfig);
const initializeDatabase = async () => {
    try {
        await exports.db.migrate.latest();
        console.log('Database migrations completed');
        const hasData = await (0, exports.db)('users').select('id').limit(1);
        if (hasData.length === 0) {
            await exports.db.seed.run();
            console.log('Database seeded with initial data');
        }
    }
    catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
//# sourceMappingURL=database.js.map