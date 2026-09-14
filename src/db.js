import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'booking.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      capacity INTEGER,
      hourly_rate REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      check_in DATETIME NOT NULL,
      check_out DATETIME NOT NULL,
      num_guests INTEGER DEFAULT 1,
      base_price REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      cancellation_fee REAL DEFAULT 0,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resource_id) REFERENCES resources(id)
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL,
      rule_type TEXT NOT NULL,
      discount_percent REAL,
      min_nights INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resource_id) REFERENCES resources(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_resource_dates
      ON bookings(resource_id, check_in, check_out);
  `);

  seedData();
}

function seedData() {
  const checkResourceExists = db.prepare('SELECT COUNT(*) as count FROM resources WHERE id = 1');
  const result = checkResourceExists.get();

  if (result.count === 0) {
    const insertResource = db.prepare(`
      INSERT INTO resources (name, type, capacity, hourly_rate)
      VALUES (?, ?, ?, ?)
    `);

    insertResource.run('Deluxe Room 101', 'hotel_room', 2, 100);
    insertResource.run('Standard Room 102', 'hotel_room', 2, 75);
    insertResource.run('Meeting Room A', 'conference', 10, 50);
    insertResource.run('Parking Space P1', 'parking', 1, 15);
  }
}

export default db;
