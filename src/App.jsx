import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const categories = [
  ['electronics', 'Electronics'],
  ['documents', 'IDs & Documents'],
  ['accessories', 'Personal Accessories'],
  ['keys', 'Keys & Access'],
  ['academic', 'Books & Calculators'],
  ['bags', 'Bags & Pouches'],
];

const categoryIcons = {
  electronics: '🎧',
  documents: '🪪',
  accessories: '🎒',
  keys: '🔑',
  academic: '📚',
  bags: '👜',
};

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

async function uploadPhoto(file) {
  if (!file || !file.name) return '';
  const body = new FormData();
  body.append('photo', file);
  const result = await request('/api/upload', { method: 'POST', body });
  return result.fileUrl;
}

function categoryName(value) {
  return categories.find(([key]) => key === value)?.[1] || value || 'Belonging';
}

function dateLabel(value) {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB');
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function App() {
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState([]);
  const [claims, setClaims] = useState([]);
  const searchInput = useRef(null);
  const [user, setUser] = useState(null);
  const [modal, setModal] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [challengePrompt, setChallengePrompt] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [claimPass, setClaimPass] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshItems = useCallback(async () => {
    const data = await request('/api/found-items');
    setItems(data.items);
  }, []);

  useEffect(() => {
    let active = true;
    request('/api/found-items')
      .then(data => { if (active) setItems(data.items); })
      .catch(error => { if (active) notify(error.message, 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    const token = localStorage.getItem('lostconnect-token');
    if (!token) return;
    request('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(data => {
        if (data.authenticated) setUser(data.user);
        else localStorage.removeItem('lostconnect-token');
      })
      .catch(error => notify(error.message, 'error'));
  }, []);

  useEffect(() => {
    if (!user) {
      setReports([]);
      setClaims([]);
      return;
    }
    let active = true;
    const studentId = encodeURIComponent(user.studentId || '');
    Promise.all([
      request(`/api/lost-items/my-reports?studentId=${studentId}`),
      request(`/api/claims/my-claims?studentId=${studentId}`),
    ])
      .then(([reportData, claimData]) => {
        if (active) {
          setReports(reportData.reports);
          setClaims(claimData.claims);
        }
      })
      .catch(error => { if (active) notify(error.message, 'error'); });
    return () => { active = false; };
  }, [user, notify]);

  useEffect(() => {
    if (!modal) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') setModal('');
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [modal]);

  useEffect(() => {
    const onKeyDown = event => {
      const activeTag = document.activeElement?.tagName;
      if (event.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const locations = useMemo(
    () => [...new Set(items.map(item => item.location).filter(Boolean))].sort(),
    [items],
  );
  const visibleItems = useMemo(() => items.filter(item => {
    const text = `${item.title} ${item.description || ''} ${item.location || ''}`.toLowerCase();
    return (category === 'all' || item.category === category)
      && (location === 'all' || item.location === location)
      && (!query.trim() || text.includes(query.trim().toLowerCase()))
      && item.status !== 'returned';
  }), [items, category, location, query]);

  function showModal(name) {
    setModal(name);
    setMenuOpen(false);
  }

  function requireSignIn(action) {
    if (user) {
      if (action === 'lost' || action === 'found') showModal(`report-${action}`);
      if (action === 'claim' && selectedItem) showModal('claim');
      return;
    }
    setPendingAction(action);
    showModal('login');
    notify('Sign in with your campus email to continue.', 'info');
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: new FormData(event.currentTarget).get('email') }),
      });
      localStorage.setItem('lostconnect-token', data.token);
      setUser(data.user);
      setModal('');
      notify(`Welcome, ${data.user.name}.`);
      const action = pendingAction;
      setPendingAction('');
      if (action === 'lost' || action === 'found') showModal(`report-${action}`);
      if (action === 'claim' && selectedItem) showModal('claim');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('lostconnect-token');
      setUser(null);
      notify('You have signed out.', 'info');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function openItem(item) {
    setSelectedItem(item);
    setChallengePrompt('');
    showModal('details');
    try {
      const data = await request(`/api/found-items/${encodeURIComponent(item.id)}`);
      setSelectedItem(data.item);
      setChallengePrompt(data.item.challengePrompt || '');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function submitReport(event, type) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const photoUrl = await uploadPhoto(values.get('photo'));
      const payload = Object.fromEntries(values.entries());
      delete payload.photo;
      if (type === 'lost') {
        payload.approxLocation = payload.location;
        delete payload.location;
        payload.studentId = user.studentId || '';
        payload.contactEmail = payload.contactEmail || user.email;
      } else {
        payload.custodyLocation = {
          security: 'Central Security Desk (Room 104)',
          reception: 'Department Reception Desk',
          finder: 'With Campus Finder',
        }[payload.custodyLocation] || 'Central Security Desk (Room 104)';
      }
      const data = await request(`/api/${type}-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, photoUrl }),
      });
      form.reset();
      setModal('');
      if (type === 'lost') {
        const match = data.matches?.[0];
        notify(match
          ? `Report posted. A possible match was found: ${match.foundItemTitle} (${match.matchPercentage}).`
          : 'Lost-item report submitted. We will scan for matches.');
      } else {
        notify(data.piiSanitized
          ? 'Found item reported. Personal details were masked before saving.'
          : 'Thank you. The found item has been added to the campus catalog.');
      }
      await refreshItems();
      if (user) {
        const result = await request(`/api/lost-items/my-reports?studentId=${encodeURIComponent(user.studentId || '')}`);
        setReports(result.reports);
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim(event) {
    event.preventDefault();
    if (!selectedItem) return;
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = await request('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, foundItemId: selectedItem.id }),
      });
      setClaimPass(data.offlinePass);
      setModal('pass');
      notify('Your claim pass is ready. Save the code for pickup.');
      const result = await request(`/api/claims/my-claims?studentId=${encodeURIComponent(user.studentId || '')}`);
      setClaims(result.claims);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function verifyChallenge(event) {
    event.preventDefault();
    if (!selectedItem) return;
    setBusy(true);
    const answer = new FormData(event.currentTarget).get('answer');
    try {
      const result = await request('/api/claims/challenge/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundItemId: selectedItem.id,
          claimantAnswer: answer,
          claimantStudentId: user.studentId || '',
          claimantName: user.name,
        }),
      });
      if (!result.verified) {
        notify(result.message, 'warning');
        return;
      }
      setClaimPass({
        claimCode: result.claimCode,
        qrPayload: result.qrPayload,
        custodyDesk: result.pickupDesk,
        instructions: 'Present your campus ID at the pickup desk.',
      });
      setModal('pass');
      const claimData = await request(`/api/claims/my-claims?studentId=${encodeURIComponent(user.studentId || '')}`);
      setClaims(claimData.claims);
      notify('Ownership challenge passed. Your pickup pass is ready.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function rescanMatches() {
    setBusy(true);
    try {
      const result = await request('/api/matches/re-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      notify(`Match scan complete: ${result.totalActiveReportsScanned} active report(s) checked.`);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="LostConnect home">
          <span className="brand-mark">✳</span>
          <span><strong>LostConnect</strong><small>CHRIST UNIVERSITY</small></span>
        </a>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
        <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
          <a href="#browse" onClick={() => setMenuOpen(false)}>Browse</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#my-reports" onClick={() => setMenuOpen(false)}>My reports</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Security desk</a>
        </nav>
        <div className="account-actions">
          {user ? (
            <>
              <span className="user-chip">{user.name}</span>
              <button className="button button-outline button-small" onClick={handleLogout}>Sign out</button>
            </>
          ) : (
            <button className="button button-outline button-small" onClick={() => showModal('login')}>Sign in</button>
          )}
          <button className="button button-primary button-small" onClick={() => requireSignIn('lost')}>＋ Report item</button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> CAMPUS LOST & FOUND</p>
            <h1>Lost something?<br /><em>Let’s bring it home.</em></h1>
            <p className="hero-description">A thoughtful, trusted way to reconnect Christ University students with the things that matter.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#browse">Browse found items <span>→</span></a>
              <button className="button button-light" onClick={() => requireSignIn('lost')}>Report a lost item</button>
            </div>
          </div>
          <div className="hero-art" aria-label="Lost and found illustration">
            <div className="art-sun" />
            <div className="art-card art-card-back">FOUND <span>✓</span></div>
            <div className="art-card art-card-front"><span className="art-sparkle">✳</span><strong>Good things<br />find their way<br /><i>back.</i></strong><small>CHRIST UNIVERSITY · BENGALURU</small></div>
            <span className="art-float art-float-one">🔑</span>
            <span className="art-float art-float-two">🎧</span>
            <span className="art-float art-float-three">✦</span>
          </div>
        </section>

        <section className="search-panel" aria-label="Search found items">
          <div className="search-input-wrap"><span>⌕</span><input ref={searchInput} aria-label="Search items" placeholder="Search by item, place, or details..." value={query} onChange={event => setQuery(event.target.value)} /><kbd>/</kbd></div>
          <span className="search-divider" />
          <label className="select-wrap"><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
          <label className="select-wrap"><span>Location</span><select value={location} onChange={event => setLocation(event.target.value)}><option value="all">All locations</option>{locations.map(place => <option key={place} value={place}>{place}</option>)}</select></label>
        </section>

        <section className="section catalog-section" id="browse">
          <div className="section-heading">
            <div><p className="eyebrow">THE CAMPUS CATALOG</p><h2>Recently found</h2><p className="section-description">Every item is safely held by a campus desk or finder.</p></div>
            <span className="count-pill">{visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          {loading ? <div className="empty-state">Loading the campus catalog…</div> : visibleItems.length === 0 ? (
            <div className="empty-state"><span>⌕</span><h3>No items found</h3><p>Try another search or clear your filters.</p><button className="text-button" onClick={() => { setQuery(''); setCategory('all'); setLocation('all'); }}>Clear filters</button></div>
          ) : (
            <div className="item-grid">
              {visibleItems.map((item, index) => (
                <article className="item-card" key={item.id}>
                  <div className={`item-visual visual-${index % 4}`}>
                    {item.photoUrl ? <img src={item.photoUrl} alt="" /> : <span className="item-emoji">{categoryIcons[item.category] || '📦'}</span>}
                    <span className="status-pill">{item.status === 'at_reception' ? 'At reception' : 'In custody'}</span>
                  </div>
                  <div className="item-body">
                    <div className="item-meta"><span>{categoryName(item.category)}</span><time>{dateLabel(item.date || item.createdAt)}</time></div>
                    <h3>{item.title}</h3>
                    <p className="item-description">{item.description}</p>
                    <div className="item-location"><span>⌖</span><span>{item.location}</span></div>
                    <div className="item-footer"><span className="item-code">#{item.itemCode || `LC-${item.id}`}</span><button onClick={() => openItem(item)}>View details <span>→</span></button></div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="catalog-footer"><button className="button button-outline" onClick={() => requireSignIn('found')}>＋ Report a found item</button><button className="text-button" onClick={refreshItems}>Refresh catalog ↻</button></div>
        </section>

        <section className="steps-section" id="how-it-works">
          <div className="section-heading centered"><div><p className="eyebrow">SIMPLE, SAFE, CAMPUS-READY</p><h2>From lost to found</h2><p className="section-description">A few careful steps are all it takes to bring a belonging home.</p></div></div>
          <div className="steps-grid">
            <article><span className="step-number">01</span><span className="step-icon">✎</span><h3>Share the details</h3><p>Post a lost report with the item's details and where you last remember seeing it.</p></article>
            <article><span className="step-number">02</span><span className="step-icon">⌕</span><h3>Find a possible match</h3><p>Our campus catalog and similarity matching help surface likely belongings.</p></article>
            <article><span className="step-number">03</span><span className="step-icon">♡</span><h3>Verify and reunite</h3><p>Prove ownership and collect safely from the listed campus security desk.</p></article>
          </div>
        </section>

        <section className="section reports-section" id="my-reports">
          <div className="reports-card">
            <div className="reports-intro"><p className="eyebrow">YOUR CAMPUS ACTIVITY</p><h2>My reports & claims</h2><p>Keep track of your lost-item reports, likely matches, and claim passes in one place.</p>{user && <button className="button button-light" onClick={rescanMatches} disabled={busy}>↻ Re-scan for matches</button>}</div>
            {user ? (
              <div className="activity-list">
                <h3>Lost-item reports <span>{reports.length}</span></h3>
                {reports.length === 0 && <p className="activity-empty">You haven't submitted a lost-item report yet.</p>}
                {reports.map(report => <div className="activity-row" key={report.id}><span className="activity-icon">⌕</span><div><strong>{report.title}</strong><small>{report.matchCount ? `${report.matchCount} possible match${report.matchCount === 1 ? '' : 'es'} · Best: ${report.topMatch?.foundItemTitle}` : 'Scanning the campus catalog'}</small></div><span className="activity-status">{report.status}</span></div>)}
                <h3 className="claims-heading">Claim passes <span>{claims.length}</span></h3>
                {claims.length === 0 && <p className="activity-empty">Claimed items and pickup codes will appear here.</p>}
                {claims.map(claim => <div className="activity-row" key={claim.id}><span className="activity-icon">✓</span><div><strong>{claim.foundItemTitle}</strong><small>{claim.claimCode} · {claim.status.replaceAll('_', ' ')}</small></div><span className="activity-status">{dateLabel(claim.createdAt)}</span></div>)}
              </div>
            ) : <div className="reports-guest"><span className="guest-icon">⌑</span><h3>Your reports, all together</h3><p>Sign in with your campus email to submit a report and keep track of your claims.</p><button className="button button-primary" onClick={() => showModal('login')}>Sign in to view reports</button></div>}
          </div>
        </section>

        <section className="contact-banner" id="contact"><div><p className="eyebrow">NEED A HAND?</p><h2>We’re here to help you reunite.</h2><p>For in-person pickup and verification, visit the Central Security Desk.</p></div><div className="desk-card"><span className="desk-icon">⌖</span><div><strong>Central Security Desk</strong><span>Central Block · Room 104</span><span>Bring your campus ID for pickup</span></div><a href="mailto:security.desk@christuniversity.in">Contact →</a></div></section>
      </main>

      <footer className="site-footer"><a className="brand footer-brand" href="#home"><span className="brand-mark">✳</span><span><strong>LostConnect</strong><small>CHRIST UNIVERSITY</small></span></a><span>Made with care for our campus community.</span><a href="#home">Back to top ↑</a></footer>

      {toast && <div className={`toast toast-${toast.tone}`} role="status"><span>{toast.tone === 'error' ? '!' : toast.tone === 'warning' ? '⚠' : '✓'}</span>{toast.message}</div>}

      {modal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(''); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="modal-close" onClick={() => setModal('')} aria-label="Close dialog">×</button>
          {modal === 'login' && <>
            <p className="eyebrow">WELCOME TO LOSTCONNECT</p><h2 id="modal-title">Sign in to your campus account</h2><p className="modal-description">Use your university email to report belongings and manage claims.</p>
            <form className="form-stack" onSubmit={handleLogin}><Field label="Campus email"><input name="email" type="email" placeholder="name@christuniversity.in" defaultValue="test.student@example.com" required /></Field><button className="button button-primary button-wide" disabled={busy}>{busy ? 'Signing in…' : 'Continue with email'}</button></form>
          </>}

          {(modal === 'report-lost' || modal === 'report-found') && <>
            <p className="eyebrow">{modal === 'report-lost' ? 'HELP US FIND IT' : 'HELP IT FIND ITS WAY HOME'}</p><h2 id="modal-title">{modal === 'report-lost' ? 'Report a lost item' : 'Report a found item'}</h2><p className="modal-description">{modal === 'report-lost' ? 'We’ll look for similar items in the campus catalog.' : 'Thank you for keeping a campus belonging safe.'}</p>
            <form className="form-stack" onSubmit={event => submitReport(event, modal === 'report-lost' ? 'lost' : 'found')}>
              <Field label="Item name"><input name="title" placeholder="e.g. Blue water bottle" required /></Field>
              <div className="form-row"><Field label="Category"><select name="category" required>{categories.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field><Field label={modal === 'report-lost' ? 'Approximate location' : 'Where did you find it?'}><input name="location" placeholder="Building, floor, or area" required /></Field></div>
              {modal === 'report-lost' ? <>
                <div className="form-row"><Field label="Date and time"><input name="lostDateTime" type="datetime-local" lang="en-GB" /></Field><Field label="Contact email"><input name="contactEmail" type="email" defaultValue={user?.email || ''} /></Field></div>
              </> : <>
                <Field label="Where is it being held?"><select name="custodyLocation"><option value="security">Central Security Desk (Room 104)</option><option value="reception">Department reception desk</option><option value="finder">With me for safekeeping</option></select></Field>
                <div className="form-row"><Field label="Your name"><input name="finderName" defaultValue={user?.name || ''} /></Field><Field label="Contact email"><input name="finderEmail" type="email" defaultValue={user?.email || ''} /></Field></div>
              </>}
              <Field label="Description and distinguishing details"><textarea name="description" rows="3" placeholder="Color, brand, marks, or other identifying details" required /></Field>
              <Field label="Photo (optional)"><input name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></Field>
              {modal === 'report-found' && <><Field label="Private ownership question (optional)"><input name="challengeQuestion" placeholder="A detail only the owner would know" /></Field><Field label="Private answer (optional)"><input name="challengeAnswer" placeholder="Keep this out of the public description" /></Field></>}
              <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
            </form>
          </>}

          {modal === 'details' && selectedItem && <>
            <p className="eyebrow">{categoryName(selectedItem.category)} <span className="eyebrow-separator">·</span> {selectedItem.itemCode}</p><h2 id="modal-title">{selectedItem.title}</h2>
            {selectedItem.photoUrl && <img className="detail-photo" src={selectedItem.photoUrl} alt={selectedItem.title} />}
            <div className="detail-facts"><span>⌖ {selectedItem.location}</span><span>◷ {dateLabel(selectedItem.date || selectedItem.createdAt)}</span><span>✓ {selectedItem.custodyLocation}</span></div>
            <p className="detail-description">{selectedItem.description}</p>
            {challengePrompt && <div className="challenge-box"><strong>Private ownership check</strong><span>This item has an owner-only verification question. Answer it during the claim process.</span></div>}
            <button className="button button-primary button-wide" onClick={() => requireSignIn('claim')}>Claim this item</button>
          </>}

          {modal === 'claim' && selectedItem && <>
            <p className="eyebrow">VERIFY YOUR OWNERSHIP</p><h2 id="modal-title">Claim {selectedItem.title}</h2><p className="modal-description">Share specific details to help our security team verify it belongs to you.</p>
            {challengePrompt && <form className="challenge-form" onSubmit={verifyChallenge}><Field label={challengePrompt}><input name="answer" required /></Field><button className="button button-dark" disabled={busy}>{busy ? 'Checking…' : 'Verify ownership'}</button><span>Correct answers can receive an instant pickup pass.</span></form>}
            <form className="form-stack" onSubmit={submitClaim}><Field label="Your full name"><input name="claimantName" defaultValue={user?.name || ''} required /></Field><div className="form-row"><Field label="Student / staff ID"><input name="studentId" defaultValue={user?.studentId || ''} required /></Field><Field label="Phone number"><input name="phone" type="tel" placeholder="+91" /></Field></div><Field label="Proof of ownership"><textarea name="proofDetails" rows="3" placeholder="Serial number, unique marks, or item contents" required /></Field><button className="button button-primary button-wide" disabled={busy}>{busy ? 'Submitting…' : 'Submit claim request'}</button></form>
          </>}

          {modal === 'pass' && claimPass && <><p className="eyebrow">OFFLINE PICKUP PASS</p><h2 id="modal-title">Your claim is ready.</h2><p className="modal-description">Keep this code and present it with your campus ID at the desk.</p><div className="pass-code">{claimPass.claimCode}</div><div className="pass-details"><strong>Pickup location</strong><span>{claimPass.custodyDesk}</span><p>{claimPass.instructions}</p></div><button className="button button-primary button-wide" onClick={() => setModal('')}>Done</button></>}
        </section>
      </div>}
    </div>
  );
}

export default App;
