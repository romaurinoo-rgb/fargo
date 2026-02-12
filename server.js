const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const APP_ROOT = __dirname;
const DATA_DIR = path.join(APP_ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'apps.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      nick TEXT,
      gameNick TEXT,
      realName TEXT,
      date TEXT,
      status TEXT,
      age TEXT,
      discord TEXT,
      online TEXT,
      majestic TEXT,
      tz TEXT,
      interests TEXT,
      surname TEXT,
      comment TEXT
    )
  `);
});

const app = express();
app.use(cors());
app.use(bodyParser.json());
const bcrypt = require('bcryptjs');

// simple in-memory admin token store (sufficient for local testing)
const ADMIN_CREDENTIALS = [
  { user: 'Fortina', pass: 'Roma101000', role: 'Владелец' },
  { user: 'Alina',   pass: 'Alina2026',   role: 'Модератор' },
  { user: 'Daniil',  pass: 'Daniil2026',  role: 'Помощник' }
];
const tokens = Object.create(null);

function makeToken(){
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function parseCookies(req){
  const header = req.headers.cookie || '';
  return header.split(/;\s*/).reduce((acc, cur)=>{
    const idx = cur.indexOf('=');
    if(idx>0){ acc[cur.slice(0,idx).trim()] = decodeURIComponent(cur.slice(idx+1)); }
    return acc;
  }, {});
}

// Admin login endpoint: accepts { user, pass }
// Ensure admins table exists and seed initial credentials
let dbReady = false;

function initAdminsTable(){
  return new Promise((resolve) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT UNIQUE,
        pass_hash TEXT,
        role TEXT
      )
    `, () => {
      // After table is created, seed initial credentials
      let completed = 0;
      const seed = ADMIN_CREDENTIALS.slice();
      
      console.log(`⚙️  Initializing admins table with ${seed.length} seed users...`);
      
      if(seed.length === 0){
        dbReady = true;
        resolve();
        return;
      }
      
      seed.forEach(s => {
        db.get(`SELECT id FROM admins WHERE user = ?`, [s.user], (err, row) => {
          if(!row){
            const hash = bcrypt.hashSync(s.pass, 10);
            db.run(`INSERT INTO admins (user, pass_hash, role) VALUES (?,?,?)`, [s.user, hash, s.role], () => {
              console.log(`  ✅ Inserted seed user: ${s.user} (role: ${s.role})`);
              completed++;
              if(completed === seed.length){
                dbReady = true;
                console.log(`✅ Admin table initialization complete`);
                resolve();
              }
            });
          }else{
            console.log(`  → User ${s.user} already exists in DB`);
            completed++;
            if(completed === seed.length){
              dbReady = true;
              console.log(`✅ Admin table initialization complete`);
              resolve();
            }
          }
        });
      });
    });
  });
}

// Initialize admins table on startup
initAdminsTable().catch(err => console.error('Admin table init error:', err));

// Fix endpoint: ensure Fortina has role "Владелец" (if it got corrupted)
app.post('/api/admin/fix-fortina', (req, res) => {
  const hash = bcrypt.hashSync('Roma101000', 10);
  db.run(`UPDATE admins SET role = 'Владелец' WHERE user = 'Fortina'`, [], function(err){
    if(err){
      console.error('Error fixing Fortina:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ Fixed Fortina's role to "Владелец"`);
    // Also verify the update
    db.get(`SELECT user, role FROM admins WHERE user = 'Fortina'`, [], (err2, row) => {
      res.json({ ok: true, user: row?.user, role: row?.role });
    });
  });
});

app.post('/api/admin/login', (req, res) => {
  const { user, pass } = req.body || {};
  if(!user || !pass) return res.status(400).json({ error: 'missing' });
  db.get(`SELECT * FROM admins WHERE user = ?`, [user], (err, row) => {
    if(err) return res.status(500).json({ error: err.message });
    if(!row) return res.status(401).json({ error: 'invalid credentials' });
    if(!row.pass_hash || !bcrypt.compareSync(pass, row.pass_hash)) return res.status(401).json({ error: 'invalid credentials' });
    const token = makeToken();
    tokens[token] = { user: row.user, role: row.role, at: Date.now(), expires: Date.now() + 1000*60*60 };
    console.log(`✅ Login successful: user="${row.user}", role="${row.role}", token="${token.slice(0,8)}..."`);
    // Try different cookie approaches
    res.setHeader('Set-Cookie', [
      `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
      `admin_token_test=${token.slice(0,8)}-test; Path=/; SameSite=Lax; Max-Age=3600`
    ]);
    console.log(`   → Set-Cookie headers applied`);
    res.json({ user: row.user, role: row.role, token });
  });
});

// Admin logout: clear token if provided in cookie
app.post('/api/admin/logout', (req, res) => {
  const cookies = parseCookies(req);
  const t = cookies['admin_token'];
  if(t && tokens[t]) delete tokens[t];
  // clear cookie
  res.setHeader('Set-Cookie', 'admin_token=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  res.json({ ok: true });
});

// Create new admin user (only owner)
app.post('/api/admin/users', (req, res) => {
  try{
    // Try token from body first, then cookies
    let t = (req.body || {}).token;
    if(!t) {
      const cookies = parseCookies(req);
      t = cookies['admin_token'];
    }
    console.log(`📝 Create user request - token: ${t ? t.slice(0,8) + '...' : 'MISSING'}`);
    console.log(`   Available tokens: ${Object.keys(tokens).map(k => k.slice(0,8)).join(', ')}`);
    if(!t) return res.status(403).json({ error: 'not allowed' });
    const tokenData = tokens[t];
    console.log(`   Token data:`, tokenData);
    if(!tokenData) return res.status(403).json({ error: 'not allowed' });
    if(tokenData.role !== 'Владелец') {
      console.log(`   ❌ Wrong role: "${tokenData.role}" (expected "Владелец")`);
      return res.status(403).json({ error: 'not allowed' });
    }
    const { user, pass, role } = req.body || {};
    if(!user || !pass) return res.status(400).json({ error: 'missing' });
    const hash = bcrypt.hashSync(pass, 10);
    db.run(`INSERT INTO admins (user, pass_hash, role) VALUES (?,?,?)`, [user, hash, role || 'Модератор'], function(err){
      if(err){
        if(err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'exists' });
        return res.status(500).json({ error: err.message });
      }
      console.log(`   ✅ Admin user created: ${user} with role: ${role || 'Модератор'}`);
      res.json({ id: this.lastID, user, role: role || 'Модератор' });
    });
  }catch(e){ res.status(500).json({ error: 'server' }); }
});

// List admin users (only owner) - GET version
app.get('/api/admin/users', (req, res) => {
  try{
    const cookies = parseCookies(req);
    const t = cookies['admin_token'];
    if(!t || !tokens[t] || tokens[t].role !== 'Владелец') return res.status(403).json({ error: 'not allowed' });
    db.all(`SELECT id, user, role FROM admins ORDER BY id ASC`, [], (err, rows)=>{
      if(err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }catch(e){ res.status(500).json({ error: 'server' }); }
});

// List admin users (only owner) - POST version (for token in body)
app.post('/api/admin/users-list', (req, res) => {
  try{
    const { token } = req.body || {};
    if(!token || !tokens[token] || tokens[token].role !== 'Владелец') return res.status(403).json({ error: 'not allowed' });
    db.all(`SELECT id, user, role FROM admins ORDER BY id ASC`, [], (err, rows)=>{
      if(err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }catch(e){ res.status(500).json({ error: 'server' }); }
});

// Debug endpoint: list all admins (no auth required) - TEMPORARY FOR DEBUGGING
app.get('/api/admin/users-debug', (req, res) => {
  db.all(`SELECT id, user, role FROM admins ORDER BY id ASC`, [], (err, rows)=>{
    if(err) return res.status(500).json({ error: err.message });
    console.log(`📋 All users in DB:`, rows);
    res.json({ message: 'Check server console for output', users: rows || [] });
  });
});

// Delete admin user (only owner)
app.delete('/api/admin/users/:id', (req, res) => {
  try{
    // Try token from body first, then cookies
    let t = (req.body || {}).token;
    if(!t) {
      const cookies = parseCookies(req);
      t = cookies['admin_token'];
    }
    console.log(`🗑️ Delete user request - id: ${req.params.id}, token: ${t ? t.slice(0,8) + '...' : 'MISSING'}`);
    if(!t) return res.status(403).json({ error: 'not allowed' });
    const tokenData = tokens[t];
    if(!tokenData || tokenData.role !== 'Владелец') {
      console.log(`   ❌ Wrong role or no token data`);
      return res.status(403).json({ error: 'not allowed' });
    }
    
    const userId = req.params.id;
    db.run(`DELETE FROM admins WHERE id = ?`, [userId], function(err){
      if(err){
        console.log(`   ❌ Delete failed:`, err.message);
        return res.status(500).json({ error: err.message });
      }
      if(this.changes === 0){
        console.log(`   ❌ User not found`);
        return res.status(404).json({ error: 'not found' });
      }
      console.log(`   ✅ Admin user deleted: ID ${userId}`);
      res.json({ success: true, id: userId });
    });
  }catch(e){ res.status(500).json({ error: 'server' }); }
});

// Debug endpoint: check current auth status
app.get('/api/admin/status', (req, res) => {
  try{
    const cookies = parseCookies(req);
    const t = cookies['admin_token'];
    console.log(`🔍 Status check - request cookies:`, req.headers.cookie || 'NO COOKIES');
    console.log(`   Parsed token: ${t ? t.slice(0,8) + '...' : 'MISSING'}`);
    if(!t){
      console.log(`   → No token found in cookies`);
      return res.json({ authed: false, reason: 'no token', cookies: req.headers.cookie || 'empty' });
    }
    const tokenData = tokens[t];
    console.log(`   Token data:`, tokenData);
    if(!tokenData){
      console.log(`   → Token not found in server store`);
      console.log(`   → Available tokens: ${Object.keys(tokens).slice(0,3).map(k => k.slice(0,8)).join(', ')}`);
      return res.json({ authed: false, reason: 'token not found in store' });
    }
    if(tokenData.expires && tokenData.expires < Date.now()){
      console.log(`   → Token expired`);
      return res.json({ authed: false, reason: 'token expired' });
    }
    console.log(`   ✅ Authed user: "${tokenData.user}", role: "${tokenData.role}"`);
    res.json({ authed: true, user: tokenData.user, role: tokenData.role });
  }catch(e){ res.status(500).json({ error: 'server' }); }
});

// Status check with token in body (for localStorage-based auth)
app.post('/api/admin/status-token', (req, res) => {
  try{
    const { token } = req.body || {};
    console.log(`🔍 Status check (token in body) - token: ${token ? token.slice(0,8) + '...' : 'MISSING'}`);
    if(!token){
      return res.json({ authed: false, reason: 'no token provided' });
    }
    const tokenData = tokens[token];
    console.log(`   Token data:`, tokenData);
    if(!tokenData){
      console.log(`   → Token not found in server store`);
      return res.json({ authed: false, reason: 'token not found' });
    }
    if(tokenData.expires && tokenData.expires < Date.now()){
      console.log(`   → Token expired`);
      return res.json({ authed: false, reason: 'token expired' });
    }
    console.log(`   ✅ Authed user: "${tokenData.user}", role: "${tokenData.role}"`);
    res.json({ authed: true, user: tokenData.user, role: tokenData.role });
  }catch(e){ res.status(500).json({ error: 'server' }); }
});

// Protect admin static pages: require valid admin_token cookie for non-GET requests
// Allow GET to admin pages (login page) so the login form is reachable at the direct URL.
app.use((req, res, next) => {
  try{
    if(String(req.path).startsWith('/pages/admin') && req.method !== 'GET'){
      const cookies = parseCookies(req);
      const t = cookies['admin_token'];
      if(!t || !tokens[t] || (tokens[t].expires && tokens[t].expires < Date.now())){
        return res.status(403).send('Access denied');
      }
    }
  }catch(_){ }
  next();
});

function makeCode(){
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

app.get('/api/ping', (req,res)=>{
  res.json({ ok: true });
});

// submit application
app.post('/api/apps', (req,res)=>{
  const body = req.body || {};
  const now = new Date().toLocaleDateString("ru-RU",{day:"2-digit",month:"short",year:"numeric"}) + ", " +
              new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});

  let code = (body.code || '').toString().trim().toUpperCase();
  if(!code) code = makeCode();

  const params = [code, body.nick||'', body.gameNick||'', body.realName||'', now, body.status||'pending', body.age||'', body.discord||'', body.online||'', body.majestic||'', body.tz||'', body.interests||'', body.surname||'', body.comment||''];

  const stmt = db.prepare(`INSERT INTO apps (code,nick,gameNick,realName,date,status,age,discord,online,majestic,tz,interests,surname,comment)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(params, function(err){
    if(err){
      // try to return existing row on unique code conflict
      if(err && err.code === 'SQLITE_CONSTRAINT'){
        db.get(`SELECT * FROM apps WHERE code = ?`, [code], (e,row)=>{
          if(e) return res.status(500).json({ error: e.message });
          return res.json(row || { code });
        });
        return;
      }
      return res.status(500).json({ error: err.message });
    }

    db.get(`SELECT * FROM apps WHERE id = ?`, [this.lastID], (e,row)=>{
      if(e) return res.status(500).json({ error: e.message });
      return res.json(row);
    });
  });
  stmt.finalize();
});

// search by code or discord (q)
app.get('/api/apps/search', (req,res)=>{
  const q = (req.query.q || '').toString().trim();
  if(!q) return res.status(400).json({ error: 'missing query' });

  const normalized = q.toUpperCase();
  // try code exact
  db.get(`SELECT * FROM apps WHERE code = ?`, [normalized], (err,row)=>{
    if(err) return res.status(500).json({ error: err.message });
    if(row) return res.json(row);
    // else search by discord (take newest)
    db.get(`SELECT * FROM apps WHERE LOWER(discord) = LOWER(?) ORDER BY id DESC LIMIT 1`, [q], (e,r2)=>{
      if(e) return res.status(500).json({ error: e.message });
      if(r2) return res.json(r2);
      return res.status(404).json({ found: false });
    });
  });
});

// list apps (basic)
app.get('/api/apps', (req,res)=>{
  db.all(`SELECT * FROM apps ORDER BY id DESC LIMIT 1000`, [], (err,rows)=>{
    if(err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// serve static site
app.use(express.static(path.join(APP_ROOT)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log('Server started on port', PORT);
});
