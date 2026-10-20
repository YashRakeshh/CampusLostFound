import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = 'http://localhost:4000/api';
const CATEGORIES = ['Electronics', 'Accessories', 'ID & Cards', 'Books', 'Keys', 'Other'];
const newReport = () => ({
  kind: 'lost', title: '', category: 'Electronics', description: '',
  location: 'Central Library', eventDate: new Date().toISOString().slice(0, 10),
  imageUrl: '', reward: '', contactPhone: ''
});

function savedUser() {
  try { return JSON.parse(localStorage.getItem('foundly-user') || 'null'); }
  catch { return null; }
}

async function request(path, options = {}, user) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { 'x-user-id': String(user.id) } : {}),
      ...options.headers
    }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'Request failed.');
  return body;
}

function Login({ onLogin }) {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('aarav@campus.edu');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseRole = (nextRole) => {
    setRole(nextRole);
    setEmail(nextRole === 'admin' ? 'admin@campus.edu' : 'aarav@campus.edu');
    setError('');
  };
  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await request('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, role })
      });
      onLogin(user);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };

  return <main className="login-shell">
    <section className="login-copy">
      <div className="brand"><span>⌕</span> Foundly</div>
      <p className="eyebrow">CAMPUS LOST & FOUND</p>
      <h1>Every return starts<br />with <em>one small clue.</em></h1>
      <p>Report items, discover thoughtful matches, and keep every handover safe.</p>
    </section>
    <section className="login-card">
      <p className="eyebrow">WELCOME BACK</p>
      <h2>{role === 'admin' ? 'Admin portal' : 'Sign in to Foundly'}</h2>
      <div className="role-switch">
        <button type="button" className={role === 'student' ? 'chosen' : ''} onClick={() => chooseRole('student')}>Student login</button>
        <button type="button" className={role === 'admin' ? 'chosen' : ''} onClick={() => chooseRole('admin')}>Admin login</button>
      </div>
      <form onSubmit={signIn}>
        <label>Campus email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value="foundly" readOnly /></label>
        <button className="primary full" disabled={busy}>{role === 'admin' ? 'Open admin dashboard' : 'Sign in →'}</button>
      </form>
      <small className="hint">Demo: student uses aarav@campus.edu · admin uses admin@campus.edu</small>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  </main>;
}

function Header({ user, tab, setTab, signOut }) {
  return <header>
    <div className="brand"><span>⌕</span> Foundly</div>
    {user.role === 'admin' ? <button className="logout" onClick={signOut}>Sign out</button> : <><nav>
      {[
        ['discover', 'Discover'], ['report', 'Report item'], ['matches', 'My matches']
      ].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    <div className="account">
      <div className="avatar">{user.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</div>
      <button className="logout" onClick={signOut}>Sign out</button>
    </div></>}
  </header>;
}

function AdminDashboard({ stats, claims, items, refresh, deleteRecord }) {
  return <section className="admin-wrap">
    <div className="admin-head">
      <div>
        <p className="eyebrow">ADMIN CONTROL CENTRE</p>
        <h2>Campus activity at a glance</h2>
        <p className="muted">Monitor traffic, moderate reports, and resolve requests.</p>
      </div>
      <button className="text" onClick={refresh}>Refresh data</button>
    </div>
    <div className="stat-grid">
      {[
        ['Site visits', stats.visits || 0], ['Total reports', stats.reports || 0],
        ['Open reports', stats.open_reports || 0], ['Approved claims', stats.approved_claims || 0]
      ].map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <section className="admin-panel">
      <h3>Pending requests</h3>
      {claims.length ? claims.map(claim => <div className="request" key={claim.id}>
        <div><strong>{claim.claimant_name}</strong><small>{claim.found_title}</small></div>
        <button className="danger" onClick={() => deleteRecord('claim', claim.id)}>Delete</button>
      </div>) : <p className="muted">No pending requests.</p>}
    </section>
    <section className="admin-panel">
      <h3>Open reports</h3>
      {items.map(item => <div className="request" key={item.id}>
        <strong>{item.title}</strong>
        <button className="danger" onClick={() => deleteRecord('report', item.id)}>Delete report</button>
      </div>)}
    </section>
  </section>;
}

function Discover({ items, refresh, showMatches, showContact }) {
  return <section className="content">
    <div className="section-head"><div><p className="eyebrow">RECENT REPORTS</p><h2>Browse what’s been found</h2></div><button className="text" onClick={refresh}>Refresh</button></div>
    <div className="filters"><span>Open reports</span><span>All categories</span><span>Newest first</span></div>
    <div className="grid">{items.map(item => <article className="item" key={item.id}>
      <div className={'thumb ' + item.category.toLowerCase()}>{item.kind === 'lost' ? 'LOST' : 'FOUND'}</div>
      <div className="item-body">
        <div className="tag">{item.category}</div><h3>{item.title}</h3><p>{item.description}</p>
        <div className="meta">⌖ {item.location} &nbsp; · &nbsp; ◷ {String(item.event_date).slice(0, 10)}</div>
        {item.kind === 'lost' && <button className="match" onClick={() => showMatches(item)}>See smart matches →</button>}
        {item.kind === 'found' && <button className="match" onClick={() => showContact(item)}>Contact finder →</button>}
      </div>
    </article>)}</div>
  </section>;
}

function ReportForm({ form, setForm, submit }) {
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  return <section className="form-wrap">
    <p className="eyebrow">NEW REPORT</p><h2>Give us the details</h2>
    <p className="muted">The more specific you are, the better the matching engine can help.</p>
    <form onSubmit={submit}>
      <div className="toggle">
        <button type="button" className={form.kind === 'lost' ? 'chosen' : ''} onClick={() => update('kind', 'lost')}>I lost something</button>
        <button type="button" className={form.kind === 'found' ? 'chosen' : ''} onClick={() => update('kind', 'found')}>I found something</button>
      </div>
      <label>Item title<input required value={form.title} onChange={event => update('title', event.target.value)} placeholder="e.g. Black wireless earbuds" /></label>
      <div className="two">
        <label>Category<select value={form.category} onChange={event => update('category', event.target.value)}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Date<input type="date" required value={form.eventDate} onChange={event => update('eventDate', event.target.value)} /></label>
      </div>
      <label>Location<input required value={form.location} onChange={event => update('location', event.target.value)} /></label>
      <label>What makes it identifiable?<textarea required value={form.description} onChange={event => update('description', event.target.value)} placeholder="Color, label, sticker, contents..." /></label>
      <label>Image URL (optional)<input type="url" value={form.imageUrl} onChange={event => update('imageUrl', event.target.value)} placeholder="https://..." /></label>
      {form.kind === 'found' && <label>Finder contact number<input type="tel" required value={form.contactPhone} onChange={event => update('contactPhone', event.target.value)} placeholder="e.g. 9876543210" /></label>}
      {form.kind === 'lost' && <label>Reward (optional)<input type="number" min="0" value={form.reward} onChange={event => update('reward', event.target.value)} /></label>}
      <button className="primary">Publish report →</button>
    </form>
  </section>;
}

function Matches({ selected, matches, claim }) {
  return <section className="content">
    <p className="eyebrow">MATCHING ENGINE</p>
    <h2>{selected ? `Matches for “${selected.title}”` : 'Choose a lost report to see possible matches.'}</h2>
    {selected && <p className="muted">Scores combine category (35%), location (25%), date proximity (20%), and keyword similarity (20%).</p>}
    <div className="match-list">{matches.map(match => <article className="match-card" key={match.id}>
      <div><div className="tag">POSSIBLE MATCH</div><h3>{match.found_title}</h3><p>⌖ {match.found_location} · {String(match.found_date).slice(0, 10)}</p></div>
      <div className="score"><strong>{Math.round(match.overall_score)}%</strong><small>category {match.category_score} · location {match.location_score} · date {match.date_score} · words {Math.round(match.keyword_score)}</small></div>
      <button className="primary" onClick={() => claim(match)}>Request claim</button>
    </article>)}</div>
    {selected && matches.length === 0 && <div className="empty">No candidates crossed the match threshold yet.</div>}
  </section>;
}

function App() {
  const [user, setUser] = useState(savedUser);
  const [tab, setTab] = useState('discover');
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({});
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(newReport);
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState([]);
  const api = (path, options) => request(path, options, user);

  const refreshItems = async () => { try { setItems(await api('/items')); } catch (error) { setMessage(error.message); } };
  const refreshAdmin = async () => {
    try {
      const [analytics, pending, reports] = await Promise.all([api('/admin/analytics'), api('/admin/claims'), api('/items')]);
      setStats(analytics); setClaims(pending); setItems(reports);
    } catch (error) { setMessage(error.message); }
  };
  useEffect(() => {
    if (!user) return;
    localStorage.setItem('foundly-user', JSON.stringify(user));
    api('/traffic', { method: 'POST' }).catch(() => {});
    if (user.role === 'admin') refreshAdmin(); else refreshItems();
  }, [user]);

  const signOut = () => { localStorage.removeItem('foundly-user'); setUser(null); setTab('discover'); setMessage(''); };
  const submit = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/items', { method: 'POST', body: JSON.stringify(form) });
      setMessage(`Report published. ${result.matchesCreated} possible match(es) generated.`);
      setForm(newReport()); setTab('discover'); refreshItems();
    } catch (error) { setMessage(error.message); }
  };
  const showMatches = async (item) => {
    try { setSelected(item); setMatches(await api(`/matches/${item.id}`)); setTab('matches'); }
    catch (error) { setMessage(error.message); }
  };
  const showContact = async (item) => {
    try {
      const contact = await api(`/items/${item.id}/contact`);
      setMessage(`Contact ${contact.name}: ${contact.contact_phone || 'Phone not provided'} · ${contact.email}`);
    } catch (error) { setMessage(error.message); }
  };
  const claim = async (match) => {
    const evidence = window.prompt('Describe a private detail that proves ownership:');
    if (!evidence?.trim()) return;
    try { await api('/claims', { method: 'POST', body: JSON.stringify({ matchId: match.id, evidence: evidence.trim() }) }); setMessage('Claim submitted for administrator verification.'); }
    catch (error) { setMessage(error.message); }
  };
  const deleteRecord = async (type, id) => {
    if (!window.confirm(`Delete this ${type}?`)) return;
    try { await api(`/admin/${type === 'report' ? 'items' : 'claims'}/${id}`, { method: 'DELETE' }); setMessage(`${type === 'report' ? 'Report' : 'Request'} deleted.`); refreshAdmin(); }
    catch (error) { setMessage(error.message); }
  };

  if (!user) return <Login onLogin={setUser} />;
  return <main>
    <Header user={user} tab={tab} setTab={setTab} signOut={signOut} />
    {user.role === 'student' && <section className="hero">
      <div><p className="eyebrow">CAMPUS COMMUNITY</p><h1>Lost something?<br /><em>Let’s bring it home.</em></h1><p>Post a report, discover smart matches, and claim safely with campus verification.</p><button className="primary" onClick={() => setTab('report')}>Report an item →</button></div>
      <div className="hero-card"><span>✦</span><p>Every return begins<br />with a small clue.</p><small>Structured reports • Explainable matches • Safe claims</small></div>
    </section>}
    {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message">×</button></div>}
    {user.role === 'admin'
      ? <AdminDashboard stats={stats} claims={claims} items={items} refresh={refreshAdmin} deleteRecord={deleteRecord} />
      : tab === 'report' ? <ReportForm form={form} setForm={setForm} submit={submit} />
      : tab === 'matches' ? <Matches selected={selected} matches={matches} claim={claim} />
      : <Discover items={items} refresh={refreshItems} showMatches={showMatches} showContact={showContact} />}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
