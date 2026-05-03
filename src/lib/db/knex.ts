import knex from 'knex';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

const knexConfig = require('../../../knexfile');
const config = isProd ? knexConfig.production : knexConfig.development;

export const db = knex(config);

export default db;
