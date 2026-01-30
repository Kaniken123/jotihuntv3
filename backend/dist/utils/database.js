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
    pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
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