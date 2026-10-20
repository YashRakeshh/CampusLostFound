import express from 'express';
import cors from 'cors';
import { pool, withTransaction } from './db.js';
import { createMatchesForItem } from './matching.js';

const app = express();
app.use(cors()); app.use(express.json());
const userId = (req) => Number(req.header('x-user-id')) || 1;

async function requireAdmin(req, res, next) {
  const { rows } = await pool.query('SELECT role FROM users WHERE id=$1', [userId(req)]);
  if (rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const { rows: [user] } = await pool.query('SELECT id, name, email, role FROM users WHERE email=$1 AND role=$2', [email, role]);
    if (!user) return res.status(401).json({ error: 'No matching demo account was found. Use aarav@campus.edu or admin@campus.edu.' });
    res.json({ user });
  } catch (e) { next(e); }
});
app.post('/api/traffic', async (_req, res, next) => {
  try { await pool.query('INSERT INTO traffic_events DEFAULT VALUES'); res.status(201).json({ recorded: true }); } catch(e) { next(e); }
});
app.get('/api/items', async (req, res, next) => {
  try {
    const values=[]; let where='WHERE i.status = $1'; values.push(req.query.status || 'open');
    if (req.query.kind) { values.push(req.query.kind); where += ` AND i.kind=$${values.length}`; }
    const { rows } = await pool.query(`SELECT i.*, u.name AS reporter_name FROM items i JOIN users u ON u.id=i.reporter_id ${where} ORDER BY i.created_at DESC`, values);
    res.json(rows);
  } catch(e) { next(e); }
});
app.get('/api/items/:itemId/contact', async (req, res, next) => {
  try {
    const { rows: [contact] } = await pool.query(`SELECT u.name, CONCAT(u.email, ' | Phone: ', COALESCE(i.contact_phone, 'not provided')) AS email, i.title, i.contact_phone
      FROM items i JOIN users u ON u.id=i.reporter_id WHERE i.id=$1 AND i.kind='found' AND i.status='open'`, [req.params.itemId]);
    if (!contact) return res.status(404).json({ error: 'Finder contact is not available for this report.' });
    res.json(contact);
  } catch (e) { next(e); }
});
app.post('/api/items', async (req, res, next) => {
  try {
    const { kind,title,category,description,location,eventDate,imageUrl,reward,contactPhone }=req.body;
    const finderPhone = contactPhone || description.match(/(?:\+?91[-\s]?)?[6-9]\d{9}/)?.[0];
    if (!['lost','found'].includes(kind) || !title || !category || !description || !location || !eventDate || (kind==='found' && !finderPhone)) return res.status(400).json({error:'Found-item reports must include the finder contact number in the description.'});
    const created=await pool.query(`INSERT INTO items(reporter_id,kind,title,category,description,location,event_date,image_url,reward,contact_phone)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[userId(req),kind,title,category,description,location,eventDate,imageUrl||null,reward||null,finderPhone||null]);
    const { rows:[item] }=await pool.query('SELECT * FROM items WHERE id=$1',[created.insertId]);
    const matches=await createMatchesForItem(pool,item.id);
    res.status(201).json({ item, matchesCreated:matches.length });
  } catch(e) { next(e); }
});
app.get('/api/matches/:lostId', async (req,res,next) => {
  try { const {rows}=await pool.query(`SELECT m.*, f.title AS found_title, f.location AS found_location, f.event_date AS found_date, f.image_url FROM matches m JOIN items f ON f.id=m.found_item_id WHERE m.lost_item_id=$1 ORDER BY m.overall_score DESC`,[req.params.lostId]); res.json(rows); } catch(e){next(e);}
});
app.get('/api/admin/claims', requireAdmin, async (_,res,next) => {
  try { const {rows}=await pool.query(`SELECT c.*, u.name claimant_name, l.title lost_title, f.title found_title FROM claims c JOIN users u ON u.id=c.claimant_id JOIN matches m ON m.id=c.match_id JOIN items l ON l.id=m.lost_item_id JOIN items f ON f.id=m.found_item_id WHERE c.status='pending' ORDER BY c.created_at`);res.json(rows); }catch(e){next(e);}
});
app.get('/api/admin/analytics', requireAdmin, async (_req,res,next) => {
  try {
    const { rows: [summary] } = await pool.query(`SELECT
      (SELECT count(*) FROM traffic_events) AS visits,
      (SELECT count(*) FROM items) AS reports,
      (SELECT count(*) FROM claims) AS requests,
      (SELECT count(*) FROM claims WHERE status='approved') AS approved_claims,
      (SELECT count(*) FROM items WHERE status='open') AS open_reports`);
    const { rows: categories } = await pool.query(`SELECT category, COUNT(*) AS count FROM items GROUP BY category ORDER BY count DESC LIMIT 5`);
    res.json({ ...summary, categories });
  } catch(e) { next(e); }
});
app.post('/api/claims', async (req,res,next) => {
  try { const { matchId,evidence }=req.body; if(!matchId||!evidence) return res.status(400).json({error:'Match and verification evidence are required.'});
    const created=await pool.query('INSERT INTO claims(match_id,claimant_id,evidence) VALUES($1,$2,$3)',[matchId,userId(req),evidence]);
    const {rows}=await pool.query('SELECT * FROM claims WHERE id=$1',[created.insertId]);
    await pool.query("UPDATE matches SET status='claimed' WHERE id=$1",[matchId]); res.status(201).json(rows[0]);
  }catch(e){next(e);}
});
app.post('/api/claims/:claimId/approve', requireAdmin, async (req,res,next) => {
  try { const approved=await withTransaction(async(db)=>{
    const {rows:[claim]}=await db.query(`SELECT c.*,m.lost_item_id,m.found_item_id FROM claims c JOIN matches m ON m.id=c.match_id WHERE c.id=$1 FOR UPDATE`,[req.params.claimId]);
    if(!claim || claim.status!=='pending') throw Object.assign(new Error('Claim is no longer pending.'),{status:409});
    const {rows:[found]}=await db.query('SELECT * FROM items WHERE id=$1 FOR UPDATE',[claim.found_item_id]);
    if(found.status!=='open') throw Object.assign(new Error('This item has already been finalized.'),{status:409});
    await db.query("UPDATE claims SET status='approved', reviewed_by=$1, reviewed_at=now() WHERE id=$2",[userId(req),claim.id]);
    await db.query(`UPDATE claims SET status='rejected', reviewed_by=$1, reviewed_at=now() WHERE status='pending' AND id<>$2 AND match_id IN (SELECT id FROM matches WHERE found_item_id=$3)`,[userId(req),claim.id,found.id]);
    await db.query("UPDATE items SET status='closed' WHERE id IN ($1,$2)",[claim.lost_item_id,claim.found_item_id]);
    await db.query("UPDATE matches SET status='verified' WHERE id=$1",[claim.match_id]);
    await db.query("INSERT INTO notifications(user_id,type,message,claim_id) SELECT reporter_id,'claim_approved','Your item claim has been verified.', $1 FROM items WHERE id IN ($2,$3)",[claim.id,claim.lost_item_id,claim.found_item_id]);
    return claim;
  }); res.json({approved:true,claim:approved});
  }catch(e){next(e);}
});
app.delete('/api/admin/claims/:claimId', requireAdmin, async (req,res,next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM claims WHERE id=$1 AND status='pending'", [req.params.claimId]);
    if (!rowCount) return res.status(404).json({ error: 'Pending claim request not found.' });
    res.status(204).end();
  } catch(e) { next(e); }
});
app.delete('/api/admin/items/:itemId', requireAdmin, async (req,res,next) => {
  try {
    await withTransaction(async(db) => {
      const { rows:[item] } = await db.query('SELECT id FROM items WHERE id=$1 FOR UPDATE', [req.params.itemId]);
      if (!item) throw Object.assign(new Error('Report not found.'), { status: 404 });
      await db.query('DELETE FROM claims WHERE match_id IN (SELECT id FROM matches WHERE lost_item_id=$1 OR found_item_id=$1)', [item.id]);
      await db.query('DELETE FROM matches WHERE lost_item_id=$1 OR found_item_id=$1', [item.id]);
      await db.query('DELETE FROM items WHERE id=$1', [item.id]);
    });
    res.status(204).end();
  } catch(e) { next(e); }
});
app.use((err,req,res,_next)=>{ console.error(err); res.status(err.status||500).json({error:err.message||'Unexpected server error.'}); });
async function start() {
  const { rows: phoneColumn } = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='items' AND COLUMN_NAME='contact_phone'`);
  if (!phoneColumn.length) await pool.query(`ALTER TABLE items ADD COLUMN contact_phone VARCHAR(30) NULL`);
  await pool.query(`CREATE TABLE IF NOT EXISTS traffic_events (id BIGINT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  app.listen(process.env.PORT||4000,()=>console.log(`API listening on ${process.env.PORT||4000}`));
}
start().catch((error) => { console.error('Unable to initialize database:', error); process.exit(1); });
