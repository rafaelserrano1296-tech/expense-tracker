import { Pool } from '@neondatabase/serverless';
import 'dotenv/config';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
