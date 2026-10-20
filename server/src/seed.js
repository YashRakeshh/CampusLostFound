import fs from 'node:fs/promises';
import { pool } from './db.js';

const sql = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
await pool.query(`INSERT IGNORE INTO users(name,email,role) VALUES
  ('Aarav Mehta','aarav@campus.edu','student'),('Diya Shah','diya@campus.edu','student'),('Campus Admin','admin@campus.edu','admin');
  INSERT IGNORE INTO items(reporter_id,kind,title,category,description,location,event_date,image_url,reward) SELECT id,'lost','Black wireless earbuds','Electronics','Black charging case with a small blue sticker.','Central Library','2026-08-25',NULL,500 FROM users WHERE email='aarav@campus.edu' AND NOT EXISTS (SELECT 1 FROM items WHERE title='Black wireless earbuds');
  INSERT IGNORE INTO items(reporter_id,kind,title,category,description,location,event_date,image_url,reward) SELECT id,'found','Wireless earbuds in black case','Electronics','Found a black earbud case near the library return desk.','Central Library','2026-08-26',NULL,NULL FROM users WHERE email='diya@campus.edu' AND NOT EXISTS (SELECT 1 FROM items WHERE title='Wireless earbuds in black case');`);
console.log('Database schema and sample reports created.');
await pool.end();
