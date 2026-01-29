import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');
  const sql = postgres(connectionString);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../drizzle/0001_deep_research_rate_limit_fix.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by statement breakpoint and filter truly empty statements
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => {
        // Remove comment-only blocks
        const withoutComments = s.replace(/--.*$/gm, '').trim();
        return withoutComments.length > 0;
      });

    console.log(`📄 Found ${statements.length} statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      // Get first non-comment line for preview
      const lines = statement.split('\n').filter(l => !l.trim().startsWith('--'));
      const preview = (lines[0] || statement.substring(0, 60)).substring(0, 60).replace(/\n/g, ' ');
      console.log(`\n⏳ [${i + 1}/${statements.length}] Executing: ${preview}...`);

      try {
        await sql.unsafe(statement);
        console.log(`✅ [${i + 1}/${statements.length}] Success`);
      } catch (error: any) {
        // Handle "already exists" errors gracefully
        if (error.message?.includes('already exists') ||
            error.message?.includes('duplicate key') ||
            error.message?.includes('multiple default values') ||
            error.code === '42701' || // column already exists
            error.code === '42P07' || // relation already exists
            error.code === '42710' || // object already exists
            error.code === '42P16') { // multiple default values
          console.log(`⚠️  [${i + 1}/${statements.length}] Already exists, skipping`);
        } else {
          throw error;
        }
      }
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...');

    const columns = await sql`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'deep_research_usage'
      ORDER BY ordinal_position
    `;
    console.log('\n📋 Table columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });

    const functions = await sql`
      SELECT proname FROM pg_proc
      WHERE proname LIKE '%deep_research%'
    `;
    console.log('\n📋 Stored functions:');
    if (functions.length === 0) {
      console.log('   (none found)');
    } else {
      functions.forEach(fn => {
        console.log(`   - ${fn.proname}`);
      });
    }

    const records = await sql`SELECT COUNT(*) as count FROM deep_research_usage`;
    console.log(`\n📊 Total records: ${records[0].count}`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
