import { randomBytes, scryptSync } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const fullName = String(process.env.ADMIN_NAME || 'مدير الأكاديمية').trim();
if (!process.env.DATABASE_URL || !email || password.length < 10) {
  console.error('Usage: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD="10+ characters" npm run create-admin');
  process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
const sql = neon(process.env.DATABASE_URL);
await sql`INSERT INTO academy_users (full_name, email, password_hash, role) VALUES (${fullName}, ${email}, ${hash}, 'admin') ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, role = 'admin', is_active = TRUE, updated_at = NOW()`;
console.log(`Admin account ready: ${email}`);
