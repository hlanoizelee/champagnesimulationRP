import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCKa9t29e9B6GKUobgvc2t-ff1sech_18g",
  authDomain: "champagne-simulation.firebaseapp.com",
  projectId: "champagne-simulation",
  storageBucket: "champagne-simulation.firebasestorage.app",
  messagingSenderId: "403686403270",
  appId: "1:403686403270:web:6f4642915344357ec9bbc7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const statusLabels = { planning: 'En réflexion', in_progress: 'En cours', completed: 'Terminé', abandoned: 'Abandonné' };
const statusColors = { planning: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981', abandoned: '#6b7280' };

const defaultCategories = [
  { id: 'cat1', name: 'Cotisations', color: '#10b981', type: 'income' },
  { id: 'cat2', name: 'Dons', color: '#8b5cf6', type: 'income' },
  { id: 'cat3', name: 'Partenariats', color: '#3b82f6', type: 'income' },
  { id: 'cat4', name: 'Serveurs', color: '#ef4444', type: 'expense' },
  { id: 'cat5', name: 'Outils', color: '#f59e0b', type: 'expense' },
  { id: 'cat6', name: 'Événements', color: '#ec4899', type: 'both' },
  { id: 'cat7', name: 'Autre', color: '#6b7280', type: 'both' },
];

const defaultWidgets = [
  { id: 'balance', name: 'Solde actuel', enabled: true },
  { id: 'income', name: 'Total recettes', enabled: true },
  { id: 'expense', name: 'Total dépenses', enabled: true },
  { id: 'projects', name: 'Projets en cours', enabled: true },
  { id: 'chart', name: 'Graphique', enabled: true },
  { id: 'lastTransactions', name: 'Dernières transactions', enabled: true },
  { id: 'lastProjects', name: 'Projets récents', enabled: true },
  { id: 'lastIdeas', name: 'Dernières idées', enabled: false },
];

const light = { primary: '#7c3238', bg: '#f8fafc', card: '#ffffff', sidebar: '#ffffff', input: '#f1f5f9', text: '#1f2937', textSec: '#4b5563', textMut: '#9ca3af', border: '#e5e7eb' };
const dark = { primary: '#9a3c44', bg: '#0f172a', card: '#1e293b', sidebar: '#1e293b', input: '#334155', text: '#f1f5f9', textSec: '#94a3b8', textMut: '#64748b', border: '#334155' };

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [widgets, setWidgets] = useState(defaultWidgets);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirm, setConfirm] = useState({ show: false, msg: '', action: null });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [loginErr, setLoginErr] = useState('');

  const theme = darkMode ? dark : light;
  const isAdmin = currentUser?.role === 'admin';

  const updateActivity = useCallback(() => setLastActivity(Date.now()), []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 30 * 60 * 1000) { handleLogout(); alert('Déconnecté pour inactivité.'); }
    }, 60000);
    return () => { events.forEach(e => window.removeEventListener(e, updateActivity)); clearInterval(interval); };
  }, [isLoggedIn, lastActivity, updateActivity]);

  useEffect(() => {
    const load = async () => {
      try {
        let usersData = (await getDocs(collection(db, 'users'))).docs.map(d => ({ id: d.id, ...d.data() }));
        if (usersData.length === 0) {
          const admin = { name: 'Administrateur', email: 'admin@csrp.fr', password: 'admin123', role: 'admin', createdAt: new Date().toISOString().split('T')[0], widgets: defaultWidgets };
          const r = await addDoc(collection(db, 'users'), admin);
          usersData = [{ id: r.id, ...admin }];
        }
        setUsers(usersData);
        setTransactions((await getDocs(collection(db, 'transactions'))).docs.map(d => ({ id: d.id, ...d.data() })));
        setRecurring((await getDocs(collection(db, 'recurring'))).docs.map(d => ({ id: d.id, ...d.data() })));
        setProjects((await getDocs(collection(db, 'projects'))).docs.map(d => ({ id: d.id, ...d.data() })));
        setIdeas((await getDocs(collection(db, 'ideas'))).docs.map(d => ({ id: d.id, ...d.data() })));
        const cats = (await getDocs(collection(db, 'categories'))).docs.map(d => ({ id: d.id, ...d.data() }));
        setCategories(cats.length > 0 ? cats : defaultCategories);
        setActivityLog((await getDocs(collection(db, 'activityLog'))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        const saved = localStorage.getItem('darkMode');
        if (saved) setDarkMode(JSON.parse(saved));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!isLoggedIn || recurring.length === 0) return;
    const apply = async () => {
      const today = new Date();
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      for (const r of recurring) {
        if (!r.active || (r.lastApplied || '') >= month) continue;
        const t = { date: `${month}-${String(r.dayOfMonth || 1).padStart(2, '0')}`, type: r.type, category: r.category, description: `${r.description} (récurrent)`, amount: r.amount };
        try {
          const ref2 = await addDoc(collection(db, 'transactions'), t);
          setTransactions(prev => [...prev, { id: ref2.id, ...t }]);
          await updateDoc(doc(db, 'recurring', r.id), { lastApplied: month });
          setRecurring(prev => prev.map(x => x.id === r.id ? { ...x, lastApplied: month } : x));
        } catch (e) { console.error(e); }
      }
    };
    apply();
  }, [isLoggedIn, recurring]);

  useEffect(() => { if (currentUser?.widgets) setWidgets(currentUser.widgets); }, [currentUser]);

  const log = async (action, details) => {
    if (!currentUser) return;
    const entry = { action, details, userName: currentUser.name, timestamp: new Date().toISOString() };
    try { const r = await addDoc(collection(db, 'activityLog'), entry); setActivityLog(prev => [{ id: r.id, ...entry }, ...prev]); } catch (e) { console.error(e); }
  };

  const handleLogin = () => {
    const user = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase().trim());
    if (user && loginPwd === user.password) { setCurrentUser(user); setIsLoggedIn(true); setLoginErr(''); setLastActivity(Date.now()); if (user.widgets) setWidgets(user.widgets); }
    else setLoginErr('Email ou mot de passe incorrect');
  };

  const handleLogout = () => { setIsLoggedIn(false); setCurrentUser(null); setLoginEmail(''); setLoginPwd(''); setMobileMenu(false); };
  const toggleDark = () => { setDarkMode(!darkMode); localStorage.setItem('darkMode', JSON.stringify(!darkMode)); };
  const showConfirm = (msg, action) => setConfirm({ show: true, msg, action });
  const execConfirm = () => { if (confirm.action) confirm.action(); setConfirm({ show: false, msg: '', action: null }); };

  const uploadFile = async (file, path) => { const r = ref(storage, path); await uploadBytes(r, file); return await getDownloadURL(r); };

  const saveWidgets = async (w) => {
    setWidgets(w);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.id), { widgets: w });
      setUsers(users.map(u => u.id === currentUser.id ? { ...u, widgets: w } : u));
      setCurrentUser({ ...currentUser, widgets: w });
    }
  };

  const saveUser = async (data) => {
    const exists = users.find(u => u.email.toLowerCase() === data.email.toLowerCase() && (!modal.data || u.id !== modal.data.id));
    if (exists) { alert('Email déjà utilisé'); return; }
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'users', modal.data.id), { name: data.name, email: data.email, role: data.role });
        setUsers(users.map(u => u.id === modal.data.id ? { ...u, ...data } : u));
        await log('Modification utilisateur', data.name);
      } else {
        const newUser = { ...data, createdAt: new Date().toISOString().split('T')[0], widgets: defaultWidgets };
        const r = await addDoc(collection(db, 'users'), newUser);
        setUsers([...users, { id: r.id, ...newUser }]);
        await log('Création utilisateur', data.name);
      }
      setModal({ type: null, data: null });
    } catch (e) { console.error(e); }
  };

  const deleteUser = async (id) => { const u = users.find(x => x.id === id); await deleteDoc(doc(db, 'users', id)); setUsers(users.filter(x => x.id !== id)); await log('Suppression utilisateur', u?.name); };
  const updatePwd = async (pwd) => { await updateDoc(doc(db, 'users', currentUser.id), { password: pwd }); setUsers(users.map(u => u.id === currentUser.id ? { ...u, password: pwd } : u)); setCurrentUser({ ...currentUser, password: pwd }); setModal({ type: null, data: null }); alert('Mot de passe modifié !'); };
  const deleteAccount = async () => { await deleteDoc(doc(db, 'users', currentUser.id)); handleLogout(); alert('Compte supprimé.'); };

  const saveTx = async (data, file) => {
    try {
      let url = data.attachmentUrl || null, name = data.attachmentName || null;
      if (file) { url = await uploadFile(file, `attachments/${Date.now()}_${file.name}`); name = file.name; }
      const tx = { ...data, attachmentUrl: url, attachmentName: name };
      if (modal.data) {
        await updateDoc(doc(db, 'transactions', modal.data.id), tx);
        setTransactions(transactions.map(t => t.id === modal.data.id ? { ...tx, id: modal.data.id } : t));
        await log('Modification transaction', `${data.description} - ${data.amount}€`);
      } else {
        const r = await addDoc(collection(db, 'transactions'), tx);
        setTransactions([...transactions, { id: r.id, ...tx }]);
        await log('Nouvelle transaction', `${data.description} - ${data.amount}€`);
      }
      setModal({ type: null, data: null });
    } catch (e) { console.error(e); }
  };
  const deleteTx = async (id) => { const t = transactions.find(x => x.id === id); await deleteDoc(doc(db, 'transactions', id)); setTransactions(transactions.filter(x => x.id !== id)); await log('Suppression transaction', t?.description); };

  const saveRec = async (data) => {
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'recurring', modal.data.id), data);
        setRecurring(recurring.map(r => r.id === modal.data.id ? { ...data, id: modal.data.id } : r));
        await log('Modification récurrence', data.description);
      } else {
        const r = await addDoc(collection(db, 'recurring'), { ...data, lastApplied: '' });
        setRecurring([...recurring, { id: r.id, ...data, lastApplied: '' }]);
        await log('Nouvelle récurrence', data.description);
      }
      setModal({ type: null, data: null });
    } catch (e) { console.error(e); }
  };
  const deleteRec = async (id) => { const r = recurring.find(x => x.id === id); await deleteDoc(doc(db, 'recurring', id)); setRecurring(recurring.filter(x => x.id !== id)); await log('Suppression récurrence', r?.description); };
  const toggleRec = async (id) => { const r = recurring.find(x => x.id === id); await updateDoc(doc(db, 'recurring', id), { active: !r.active }); setRecurring(recurring.map(x => x.id === id ? { ...x, active: !x.active } : x)); };

  const saveProj = async (data) => {
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'projects', modal.data.id), data);
        setProjects(projects.map(p => p.id === modal.data.id ? { ...data, id: modal.data.id, comments: modal.data.comments || [] } : p));
        await log('Modification projet', data.title);
      } else {
        const r = await addDoc(collection(db, 'projects'), { ...data, comments: [], archived: false });
        setProjects([...projects, { id: r.id, ...data, comments: [], archived: false }]);
        await log('Nouveau projet', data.title);
      }
      setModal({ type: null, data: null });
    } catch (e) { console.error(e); }
  };
  const deleteProj = async (id) => { const p = projects.find(x => x.id === id); await deleteDoc(doc(db, 'projects', id)); setProjects(projects.filter(x => x.id !== id)); await log('Suppression projet', p?.title); };
  const archiveProj = async (id) => { const p = projects.find(x => x.id === id); await updateDoc(doc(db, 'projects', id), { archived: true }); setProjects(projects.map(x => x.id === id ? { ...x, archived: true } : x)); await log('Archivage projet', p?.title); };
  const unarchiveProj = async (id) => { await updateDoc(doc(db, 'projects', id), { archived: false }); setProjects(projects.map(x => x.id === id ? { ...x, archived: false } : x)); };
  const addComment = async (pid, text) => { const p = projects.find(x => x.id === pid); const c = { id: Date.now(), author: currentUser.name, text, date: new Date().toISOString() }; const comments = [...(p.comments || []), c]; await updateDoc(doc(db, 'projects', pid), { comments }); setProjects(projects.map(x => x.id === pid ? { ...x, comments } : x)); await log('Commentaire', p?.title); };
  const delComment = async (pid, cid) => { const p = projects.find(x => x.id === pid); const comments = (p.comments || []).filter(c => c.id !== cid); await updateDoc(doc(db, 'projects', pid), { comments }); setProjects(projects.map(x => x.id === pid ? { ...x, comments } : x)); };

  const saveIdea = async (data) => {
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'ideas', modal.data.id), data);
        setIdeas(ideas.map(i => i.id === modal.data.id ? { ...data, id: modal.data.id } : i));
        await log('Modification idée', data.title);
      } else {
        const newIdea = { ...data, author: currentUser.name, date: new Date().toISOString().split('T')[0], votes: 0, archived: false };
        const r = await addDoc(collection(db, 'ideas'), newIdea);
        setIdeas([...ideas, { id: r.id, ...newIdea }]);
        await log('Nouvelle idée', data.title);
      }
      setModal({ type: null, data: null });
    } catch (e) { console.error(e); }
  };
  const deleteIdea = async (id) => { const i = ideas.find(x => x.id === id); await deleteDoc(doc(db, 'ideas', id)); setIdeas(ideas.filter(x => x.id !== id)); await log('Suppression idée', i?.title); };
  const archiveIdea = async (id) => { await updateDoc(doc(db, 'ideas', id), { archived: true }); setIdeas(ideas.map(x => x.id === id ? { ...x, archived: true } : x)); };
  const unarchiveIdea = async (id) => { await updateDoc(doc(db, 'ideas', id), { archived: false }); setIdeas(ideas.map(x => x.id === id ? { ...x, archived: false } : x)); };
  const voteIdea = async (id) => { const i = ideas.find(x => x.id === id); const v = (i.votes || 0) + 1; await updateDoc(doc(db, 'ideas', id), { votes: v }); setIdeas(ideas.map(x => x.id === id ? { ...x, votes: v } : x)); };

  const saveCat = async (data) => {
    try {
      if (modal.data?.id && !modal.data.id.startsWith('cat')) {
        await updateDoc(doc(db, 'categories', modal.data.id), data);
        setCategories(categories.map(c => c.id === modal.data.id ? { ...data, id: modal.data.id } : c));
        await log('Modification catégorie', data.name);
      } else {
        const r = await addDoc(collection(db, 'categories'), data);
        setCategories([...categories, { id: r.id, ...data }]);
        await log('Nouvelle catégorie', data.name);
      }
      setModal({ type: null, data: null });
    } catch (e) { console.error(e); }
  };
  const deleteCat = async (id) => { if (id.startsWith('cat')) { setCategories(categories.filter(c => c.id !== id)); } else { const c = categories.find(x => x.id === id); await deleteDoc(doc(db, 'categories', id)); setCategories(categories.filter(x => x.id !== id)); await log('Suppression catégorie', c?.name); } };

  const exportCSV = () => {
    const rows = [['Date', 'Type', 'Catégorie', 'Description', 'Montant']];
    filteredTx.forEach(t => rows.push([new Date(t.date).toLocaleDateString('fr-FR'), t.type === 'income' ? 'Recette' : 'Dépense', t.category, t.description, `${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}€`]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  const filteredTx = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (filterFrom && t.date < filterFrom) return false;
    if (filterTo && t.date > filterTo) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredProj = projects.filter(p => {
    if (!showArchived && p.archived) return false;
    if (showArchived && !p.archived) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredIdeas = ideas.filter(i => {
    if (!showArchived && i.archived) return false;
    if (showArchived && !i.archived) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalIn = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIn - totalOut;
  const projInProgress = projects.filter(p => p.status === 'in_progress' && !p.archived).length;

  const chartData = () => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const inc = transactions.filter(t => t.type === 'income' && t.date?.startsWith(key)).reduce((s, t) => s + t.amount, 0);
      const exp = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(key)).reduce((s, t) => s + t.amount, 0);
      data.push({ month: d.toLocaleDateString('fr-FR', { month: 'short' }), income: inc, expense: exp });
    }
    return data;
  };

  const resetFilters = () => { setSearch(''); setFilterType('all'); setFilterCat('all'); setFilterFrom(''); setFilterTo(''); };
  const getW = (id) => widgets.find(w => w.id === id);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg }}><p style={{ color: theme.text }}>Chargement...</p></div>;

  // === PARTIE 2 - COLLER DIRECTEMENT APRÈS LA PARTIE 1 ===

  if (!isLoggedIn) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', padding: 20 }}>
      <div style={{ background: theme.card, borderRadius: 20, padding: 40, width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.primary }}><span style={{ fontSize: 34 }}>C</span>HAMPAGNE</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.primary, letterSpacing: 6 }}>SIMULATION</div>
        </div>
        <h2 style={{ textAlign: 'center', color: theme.text, fontSize: 18, marginBottom: 30 }}>Espace Administration</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Email</label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: 14, borderRadius: 10, border: `2px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Mot de passe</label><input type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: 14, borderRadius: 10, border: `2px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
          {loginErr && <p style={{ color: '#dc2626', textAlign: 'center', margin: 0 }}>{loginErr}</p>}
          <button onClick={handleLogin} style={{ padding: 16, background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Se connecter</button>
        </div>
        <p style={{ marginTop: 20, fontSize: 11, color: theme.textMut, textAlign: 'center', background: theme.input, padding: 12, borderRadius: 8 }}>En vous connectant, vous acceptez que vos données soient stockées pour la gestion interne de l'association.</p>
        <button onClick={toggleDark} style={{ marginTop: 16, background: 'none', border: 'none', color: theme.textMut, cursor: 'pointer', width: '100%' }}>{darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}</button>
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Tableau de bord' },
    { id: 'finances', icon: '💰', label: 'Finances' },
    { id: 'recurring', icon: '🔄', label: 'Récurrences' },
    { id: 'projects', icon: '📁', label: 'Projets' },
    { id: 'ideas', icon: '💡', label: 'Boîte à idées' },
    ...(isAdmin ? [{ id: 'users', icon: '👥', label: 'Utilisateurs' }, { id: 'categories', icon: '🏷️', label: 'Catégories' }, { id: 'history', icon: '📜', label: 'Historique' }] : [])
  ];

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <header style={{ background: 'linear-gradient(135deg, #7c3238, #5c2428)', color: 'white', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="mobile-menu-btn" style={{ display: 'none', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 22, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>☰</button>
          <div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ fontSize: 22 }}>C</span>HAMPAGNE <span style={{ fontWeight: 600, opacity: 0.9 }}>SIMULATION</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="user-info" style={{ textAlign: 'right', marginRight: 8 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{currentUser.name}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{isAdmin ? 'Administrateur' : 'Lecteur'}</div></div>
          <button onClick={toggleDark} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>{darkMode ? '☀️' : '🌙'}</button>
          <button onClick={() => setModal({ type: 'password', data: null })} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>🔑</button>
          <button onClick={() => setModal({ type: 'deleteAccount', data: null })} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.3)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>🗑️</button>
          <button onClick={handleLogout} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Déconnexion</button>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={`sidebar ${mobileMenu ? 'open' : ''}`} style={{ width: 220, background: theme.sidebar, borderRight: `1px solid ${theme.border}`, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenu(false); setSearch(''); setShowArchived(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: activeTab === item.id ? 'linear-gradient(135deg, #7c3238, #9a3c44)' : 'transparent', color: activeTab === item.id ? 'white' : theme.text, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'left', width: '100%' }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        {mobileMenu && <div onClick={() => setMobileMenu(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />}

        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Tableau de bord</h1>
                <button onClick={() => setModal({ type: 'widgets', data: null })} style={{ padding: '8px 14px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>⚙️ Personnaliser</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                {getW('balance')?.enabled && <div style={{ background: theme.card, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: theme.primary }}><span style={{ fontSize: 28 }}>💶</span><div><div style={{ fontSize: 12, color: theme.textSec }}>Solde actuel</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{balance.toFixed(2)} €</div></div></div>}
                {getW('income')?.enabled && <div style={{ background: theme.card, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: '#10b981' }}><span style={{ fontSize: 28 }}>📈</span><div><div style={{ fontSize: 12, color: theme.textSec }}>Total recettes</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{totalIn.toFixed(2)} €</div></div></div>}
                {getW('expense')?.enabled && <div style={{ background: theme.card, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: '#ef4444' }}><span style={{ fontSize: 28 }}>📉</span><div><div style={{ fontSize: 12, color: theme.textSec }}>Total dépenses</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{totalOut.toFixed(2)} €</div></div></div>}
                {getW('projects')?.enabled && <div style={{ background: theme.card, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: '#3b82f6' }}><span style={{ fontSize: 28 }}>🚀</span><div><div style={{ fontSize: 12, color: theme.textSec }}>Projets en cours</div><div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{projInProgress}</div></div></div>}
              </div>
              {getW('chart')?.enabled && (
                <div style={{ background: theme.card, borderRadius: 12, padding: 20, marginBottom: 24, border: `1px solid ${theme.border}` }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, marginBottom: 16 }}>Évolution (6 derniers mois)</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 180, gap: 8 }}>
                    {chartData().map((d, i) => { const max = Math.max(...chartData().map(x => Math.max(x.income, x.expense)), 1); return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140 }}>
                          <div style={{ width: 20, background: '#10b981', borderRadius: '4px 4px 0 0', height: `${(d.income / max) * 100}%`, minHeight: d.income > 0 ? 4 : 0 }} />
                          <div style={{ width: 20, background: '#ef4444', borderRadius: '4px 4px 0 0', height: `${(d.expense / max) * 100}%`, minHeight: d.expense > 0 ? 4 : 0 }} />
                        </div>
                        <span style={{ fontSize: 11, color: theme.textMut, marginTop: 8 }}>{d.month}</span>
                      </div>
                    ); })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textSec }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 3 }} /> Recettes</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textSec }}><span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 3 }} /> Dépenses</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {getW('lastTransactions')?.enabled && (
                  <div style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${theme.border}` }}>Dernières transactions</h3>
                    {transactions.slice(-5).reverse().map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: theme.input, borderRadius: 6, marginBottom: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 4, background: t.type === 'income' ? '#10b981' : '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{t.type === 'income' ? '+' : '-'}</span>
                        <span style={{ flex: 1, fontSize: 14, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</span>
                        <span style={{ fontWeight: 600, color: t.type === 'income' ? '#10b981' : '#ef4444', fontSize: 14 }}>{t.type === 'income' ? '+' : '-'}{t.amount?.toFixed(2)}€</span>
                        {t.attachmentUrl && <span>📎</span>}
                      </div>
                    ))}
                    {transactions.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucune transaction</p>}
                  </div>
                )}
                {getW('lastProjects')?.enabled && (
                  <div style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${theme.border}` }}>Projets en cours</h3>
                    {projects.filter(p => (p.status === 'in_progress' || p.status === 'planning') && !p.archived).slice(0, 5).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: theme.input, borderRadius: 6, marginBottom: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[p.status] }} />
                        <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{p.title}</span>
                        <span style={{ fontSize: 12, color: theme.textMut }}>{statusLabels[p.status]}</span>
                        {p.comments?.length > 0 && <span>💬{p.comments.length}</span>}
                      </div>
                    ))}
                    {projects.filter(p => !p.archived).length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucun projet</p>}
                  </div>
                )}
                {getW('lastIdeas')?.enabled && (
                  <div style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${theme.border}` }}>Dernières idées</h3>
                    {ideas.filter(i => !i.archived).slice(-5).reverse().map(i => (
                      <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: theme.input, borderRadius: 6, marginBottom: 8 }}>
                        <span>💡</span><span style={{ flex: 1, fontSize: 14, color: theme.text }}>{i.title}</span><span style={{ fontSize: 12, color: theme.textMut }}>❤️{i.votes || 0}</span>
                      </div>
                    ))}
                    {ideas.filter(i => !i.archived).length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucune idée</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FINANCES */}
          {activeTab === 'finances' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Finances</h1>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={exportCSV} style={{ padding: '10px 16px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>📥 CSV</button>
                  {isAdmin && <button onClick={() => setModal({ type: 'transaction', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Transaction</button>}
                </div>
              </div>
              <div style={{ background: theme.card, borderRadius: 12, padding: 16, marginBottom: 20, border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 200, position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span><input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, boxSizing: 'border-box' }} /></div>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }}><option value="all">Tous</option><option value="income">Recettes</option><option value="expense">Dépenses</option></select>
                  <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }}><option value="all">Catégories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />
                  <span style={{ color: theme.textMut }}>au</span>
                  <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} />
                  <button onClick={resetFilters} style={{ padding: '10px 16px', background: 'none', border: 'none', color: theme.primary, cursor: 'pointer' }}>Réinitialiser</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 30, padding: 20, background: theme.card, borderRadius: 12, marginBottom: 20, border: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.textSec }}>Recettes</div><div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{totalIn.toFixed(2)} €</div></div>
                <div style={{ fontSize: 24, color: theme.textMut }}>-</div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.textSec }}>Dépenses</div><div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{totalOut.toFixed(2)} €</div></div>
                <div style={{ fontSize: 24, color: theme.textMut }}>=</div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.textSec }}>Solde</div><div style={{ fontSize: 24, fontWeight: 700, color: balance >= 0 ? '#10b981' : '#ef4444' }}>{balance.toFixed(2)} €</div></div>
              </div>
              <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead><tr>{['Date', 'Type', 'Catégorie', 'Description', 'Montant', 'PJ', ...(isAdmin ? ['Actions'] : [])].map(h => <th key={h} style={{ textAlign: 'left', padding: 14, background: theme.input, fontWeight: 600, fontSize: 12, color: theme.textSec, borderBottom: `2px solid ${theme.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredTx.map(t => { const cat = categories.find(c => c.name === t.category); return (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: 14, color: theme.text }}>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: 14 }}><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: t.type === 'income' ? '#dcfce7' : '#fee2e2', color: t.type === 'income' ? '#166534' : '#991b1b' }}>{t.type === 'income' ? 'Recette' : 'Dépense'}</span></td>
                        <td style={{ padding: 14 }}><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, color: 'white', background: cat?.color || '#6b7280' }}>{t.category}</span></td>
                        <td style={{ padding: 14, color: theme.text }}>{t.description}</td>
                        <td style={{ padding: 14, fontWeight: 600, color: t.type === 'income' ? '#10b981' : '#ef4444' }}>{t.type === 'income' ? '+' : '-'}{t.amount?.toFixed(2)} €</td>
                        <td style={{ padding: 14 }}>{t.attachmentUrl ? <a href={t.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.primary }}>📎</a> : '-'}</td>
                        {isAdmin && <td style={{ padding: 14 }}><button onClick={() => setModal({ type: 'transaction', data: t })} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button><button onClick={() => showConfirm('Supprimer ?', () => deleteTx(t.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>🗑️</button></td>}
                      </tr>
                    ); })}
                  </tbody>
                </table>
                {filteredTx.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucune transaction</p>}
              </div>
            </div>
          )}

          {/* RECURRING */}
          {activeTab === 'recurring' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Transactions récurrentes</h1>
                {isAdmin && <button onClick={() => setModal({ type: 'recurring', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Récurrence</button>}
              </div>
              <p style={{ color: theme.textSec, marginBottom: 20, fontSize: 14 }}>Les transactions sont créées automatiquement chaque mois.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {recurring.map(r => (
                  <div key={r.id} style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}`, opacity: r.active ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: r.type === 'income' ? '#dcfce7' : '#fee2e2', color: r.type === 'income' ? '#166534' : '#991b1b' }}>{r.type === 'income' ? 'Recette' : 'Dépense'}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: r.active ? '#dcfce7' : '#fee2e2', color: r.active ? '#166534' : '#991b1b' }}>{r.active ? 'Actif' : 'Inactif'}</span>
                      </div>
                      {isAdmin && <div>
                        <button onClick={() => toggleRec(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>{r.active ? '⏸️' : '▶️'}</button>
                        <button onClick={() => setModal({ type: 'recurring', data: r })} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button>
                        <button onClick={() => showConfirm('Supprimer ?', () => deleteRec(r.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>🗑️</button>
                      </div>}
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 8 }}>{r.description}</h3>
                    <div style={{ fontSize: 24, fontWeight: 700, color: r.type === 'income' ? '#10b981' : '#ef4444', marginBottom: 12 }}>{r.type === 'income' ? '+' : '-'}{r.amount?.toFixed(2)} €</div>
                    <div style={{ fontSize: 13, color: theme.textMut }}>📅 Jour {r.dayOfMonth || 1} • 🏷️ {r.category}</div>
                  </div>
                ))}
              </div>
              {recurring.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucune récurrence</p>}
            </div>
          )}

          {/* === PARTIE 3 - COLLER DIRECTEMENT APRÈS LA PARTIE 2 === */}
          
          {/* PROJECTS */}
          {activeTab === 'projects' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Projets {showArchived && '(Archivés)'}</h1>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowArchived(!showArchived)} style={{ padding: '10px 16px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>{showArchived ? '📁 Actifs' : '📦 Archivés'}</button>
                  <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span><input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '10px 10px 10px 38px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} /></div>
                  {isAdmin && !showArchived && <button onClick={() => setModal({ type: 'project', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Projet</button>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
                {filteredProj.map(p => (
                  <div key={p.id} style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'white', background: statusColors[p.status] }}>{statusLabels[p.status]}</span>
                      <div>
                        {isAdmin && !p.archived && <button onClick={() => archiveProj(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>📦</button>}
                        {isAdmin && p.archived && <button onClick={() => unarchiveProj(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>📁</button>}
                        {isAdmin && <button onClick={() => setModal({ type: 'project', data: p })} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button>}
                        {isAdmin && <button onClick={() => showConfirm('Supprimer ?', () => deleteProj(p.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>🗑️</button>}
                      </div>
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 10 }}>{p.title}</h3>
                    <p style={{ fontSize: 14, color: theme.textSec, marginBottom: 14 }}>{p.description}</p>
                    <div style={{ fontSize: 13, color: theme.textMut, marginBottom: 10 }}>👤 {p.responsible} {p.deadline && `• 📅 ${new Date(p.deadline).toLocaleDateString('fr-FR')}`}</div>
                    {p.notes && <p style={{ fontSize: 13, color: theme.primary, background: '#fef2f2', padding: 10, borderRadius: 6, marginBottom: 14 }}>📝 {p.notes}</p>}
                    <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>💬 Commentaires ({p.comments?.length || 0})</span>
                        <button onClick={() => setModal({ type: 'comment', data: p })} style={{ padding: '6px 12px', background: theme.input, color: theme.text, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Voir / Ajouter</button>
                      </div>
                      {p.comments?.slice(-2).map(c => (
                        <div key={c.id} style={{ background: theme.input, padding: 10, borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontWeight: 600, color: theme.text }}>{c.author}</span><span style={{ color: theme.textMut, fontSize: 11 }}>{new Date(c.date).toLocaleDateString('fr-FR')}</span></div>
                          <p style={{ color: theme.textSec, margin: 0 }}>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {filteredProj.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>{showArchived ? 'Aucun projet archivé' : 'Aucun projet'}</p>}
            </div>
          )}

          {/* IDEAS */}
          {activeTab === 'ideas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Boîte à idées {showArchived && '(Archivées)'}</h1>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowArchived(!showArchived)} style={{ padding: '10px 16px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>{showArchived ? '💡 Actives' : '📦 Archivées'}</button>
                  <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span><input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '10px 10px 10px 38px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }} /></div>
                  {!showArchived && <button onClick={() => setModal({ type: 'idea', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Idée</button>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {filteredIdeas.sort((a, b) => (b.votes || 0) - (a.votes || 0)).map(i => (
                  <div key={i.id} style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: theme.textSec }}>💡 {i.author}</span>
                      <div>
                        {isAdmin && !i.archived && <button onClick={() => archiveIdea(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>📦</button>}
                        {isAdmin && i.archived && <button onClick={() => unarchiveIdea(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>💡</button>}
                        {isAdmin && <button onClick={() => setModal({ type: 'idea', data: i })} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button>}
                        {isAdmin && <button onClick={() => showConfirm('Supprimer ?', () => deleteIdea(i.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>🗑️</button>}
                      </div>
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 10 }}>{i.title}</h3>
                    <p style={{ fontSize: 14, color: theme.textSec, marginBottom: 14 }}>{i.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                      <span style={{ fontSize: 12, color: theme.textMut }}>{new Date(i.date).toLocaleDateString('fr-FR')}</span>
                      {!i.archived && <button onClick={() => voteIdea(i.id)} style={{ padding: '8px 14px', background: '#fef2f2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: theme.primary }}>❤️ {i.votes || 0}</button>}
                    </div>
                  </div>
                ))}
              </div>
              {filteredIdeas.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>{showArchived ? 'Aucune idée archivée' : 'Aucune idée'}</p>}
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && isAdmin && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Utilisateurs</h1>
                <button onClick={() => setModal({ type: 'user', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Utilisateur</button>
              </div>
              <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Nom', 'Email', 'Rôle', 'Création', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: 14, background: theme.input, fontWeight: 600, fontSize: 12, color: theme.textSec, borderBottom: `2px solid ${theme.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: 14, color: theme.text }}>{u.name}</td>
                        <td style={{ padding: 14, color: theme.text }}>{u.email}</td>
                        <td style={{ padding: 14 }}><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'white', background: u.role === 'admin' ? '#7c3238' : '#64748b' }}>{u.role === 'admin' ? 'Admin' : 'Lecteur'}</span></td>
                        <td style={{ padding: 14, color: theme.text }}>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: 14 }}>
                          <button onClick={() => setModal({ type: 'user', data: u })} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button>
                          <button onClick={() => showConfirm('Supprimer ?', () => deleteUser(u.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }} disabled={u.id === currentUser.id}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CATEGORIES */}
          {activeTab === 'categories' && isAdmin && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Catégories</h1>
                <button onClick={() => setModal({ type: 'category', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Catégorie</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                {categories.map(c => (
                  <div key={c.id} style={{ background: theme.card, borderRadius: 12, padding: 16, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: c.color }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: c.color }} /><span style={{ fontWeight: 600, color: theme.text }}>{c.name}</span></div>
                      <div><button onClick={() => setModal({ type: 'category', data: c })} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button><button onClick={() => showConfirm('Supprimer ?', () => deleteCat(c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>🗑️</button></div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: theme.textMut }}>{c.type === 'income' ? '📈 Recettes' : c.type === 'expense' ? '📉 Dépenses' : '📊 Les deux'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && isAdmin && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 20 }}>Historique</h1>
              <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Date/Heure', 'Utilisateur', 'Action', 'Détails'].map(h => <th key={h} style={{ textAlign: 'left', padding: 14, background: theme.input, fontWeight: 600, fontSize: 12, color: theme.textSec, borderBottom: `2px solid ${theme.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {activityLog.slice(0, 100).map(l => (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: 14, color: theme.text, fontSize: 13 }}>{new Date(l.timestamp).toLocaleString('fr-FR')}</td>
                        <td style={{ padding: 14, color: theme.text }}>{l.userName}</td>
                        <td style={{ padding: 14, color: theme.text }}>{l.action}</td>
                        <td style={{ padding: 14, color: theme.textSec }}>{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {activityLog.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucune activité</p>}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {modal.type && (
        <div onClick={() => setModal({ type: null, data: null })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            {modal.type === 'user' && <UserForm data={modal.data} onSave={saveUser} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'transaction' && <TxForm data={modal.data} onSave={saveTx} onClose={() => setModal({ type: null, data: null })} categories={categories} theme={theme} />}
            {modal.type === 'recurring' && <RecForm data={modal.data} onSave={saveRec} onClose={() => setModal({ type: null, data: null })} categories={categories} theme={theme} />}
            {modal.type === 'project' && <ProjForm data={modal.data} onSave={saveProj} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'idea' && <IdeaForm data={modal.data} onSave={saveIdea} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'category' && <CatForm data={modal.data} onSave={saveCat} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'password' && <PwdForm onSave={updatePwd} onClose={() => setModal({ type: null, data: null })} currentPwd={currentUser.password} theme={theme} />}
            {modal.type === 'deleteAccount' && <DelAccForm onConfirm={deleteAccount} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'widgets' && <WidgetsForm widgets={widgets} onSave={saveWidgets} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'comment' && <CommentForm project={modal.data} onSave={(t) => { addComment(modal.data.id, t); setModal({ type: null, data: null }); }} onDelete={(cid) => delComment(modal.data.id, cid)} onClose={() => setModal({ type: null, data: null })} theme={theme} currentUser={currentUser} isAdmin={isAdmin} />}
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirm.show && (
        <div onClick={() => setConfirm({ show: false, msg: '', action: null })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: theme.text, marginBottom: 24 }}>{confirm.msg}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setConfirm({ show: false, msg: '', action: null })} style={{ padding: '12px 24px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
              <button onClick={execConfirm} style={{ padding: '12px 24px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
          .user-info { display: none !important; }
          .sidebar { position: fixed; top: 56px; left: 0; bottom: 0; transform: translateX(-100%); z-index: 60; transition: transform 0.3s; }
          .sidebar.open { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// === PARTIE 4 - COLLER DIRECTEMENT APRÈS LA PARTIE 3 ===

function UserForm({ data, onSave, onClose, theme }) {
  const [name, setName] = useState(data?.name || '');
  const [email, setEmail] = useState(data?.email || '');
  const [pwd, setPwd] = useState('');
  const [role, setRole] = useState(data?.role || 'reader');
  const isEdit = !!data;
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{isEdit ? 'Modifier' : 'Nouvel'} utilisateur</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nom</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        {!isEdit && <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Mot de passe</label><input type="password" value={pwd} onChange={e => setPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>}
        {isEdit && <p style={{ fontSize: 13, color: theme.textSec, background: theme.input, padding: 12, borderRadius: 8 }}>ℹ️ Seul l'utilisateur peut modifier son mot de passe</p>}
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Rôle</label><select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="admin">Administrateur</option><option value="reader">Lecteur</option></select></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (name && email && (isEdit || pwd)) onSave(isEdit ? { name, email, role } : { name, email, password: pwd, role }); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function TxForm({ data, onSave, onClose, categories, theme }) {
  const [date, setDate] = useState(data?.date || new Date().toISOString().split('T')[0]);
  const [type, setType] = useState(data?.type || 'expense');
  const [cat, setCat] = useState(data?.category || 'Autre');
  const [desc, setDesc] = useState(data?.description || '');
  const [amount, setAmount] = useState(data?.amount || '');
  const [file, setFile] = useState(null);
  const filteredCats = categories.filter(c => c.type === 'both' || c.type === type);
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} transaction</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recette</option><option value="expense">Dépense</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Catégorie</label><select value={cat} onChange={e => setCat(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}>{filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><input value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Montant (€)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Pièce jointe</label><input type="file" onChange={e => setFile(e.target.files[0])} style={{ marginTop: 6 }} />{data?.attachmentUrl && <p style={{ fontSize: 12, color: theme.textMut, marginTop: 4 }}>📎 {data.attachmentName}</p>}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (desc && amount) onSave({ date, type, category: cat, description: desc, amount: parseFloat(amount), attachmentUrl: data?.attachmentUrl, attachmentName: data?.attachmentName }, file); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function RecForm({ data, onSave, onClose, categories, theme }) {
  const [type, setType] = useState(data?.type || 'expense');
  const [cat, setCat] = useState(data?.category || 'Autre');
  const [desc, setDesc] = useState(data?.description || '');
  const [amount, setAmount] = useState(data?.amount || '');
  const [day, setDay] = useState(data?.dayOfMonth || 1);
  const [active, setActive] = useState(data?.active !== false);
  const filteredCats = categories.filter(c => c.type === 'both' || c.type === type);
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} récurrence</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recette</option><option value="expense">Dépense</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Catégorie</label><select value={cat} onChange={e => setCat(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}>{filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><input value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Montant (€)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Jour du mois (1-28)</label><input type="number" min="1" max="28" value={day} onChange={e => setDay(parseInt(e.target.value))} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><label style={{ color: theme.text }}>Actif</label></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (desc && amount) onSave({ type, category: cat, description: desc, amount: parseFloat(amount), dayOfMonth: day, active }); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function ProjForm({ data, onSave, onClose, theme }) {
  const [title, setTitle] = useState(data?.title || '');
  const [status, setStatus] = useState(data?.status || 'planning');
  const [resp, setResp] = useState(data?.responsible || '');
  const [desc, setDesc] = useState(data?.description || '');
  const [deadline, setDeadline] = useState(data?.deadline || '');
  const [notes, setNotes] = useState(data?.notes || '');
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouveau'} projet</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Titre</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Statut</label><select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="planning">En réflexion</option><option value="in_progress">En cours</option><option value="completed">Terminé</option><option value="abandoned">Abandonné</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Responsable</label><input value={resp} onChange={e => setResp(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 80, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Échéance</label><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 60, boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (title && resp && desc) onSave({ title, status, responsible: resp, description: desc, deadline, notes }); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function IdeaForm({ data, onSave, onClose, theme }) {
  const [title, setTitle] = useState(data?.title || '');
  const [desc, setDesc] = useState(data?.description || '');
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Proposer une'} idée</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Titre</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Décrivez votre idée..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 100, boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (title && desc) onSave({ title, description: desc }); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Proposer</button>
        </div>
      </div>
    </div>
  );
}

function CatForm({ data, onSave, onClose, theme }) {
  const [name, setName] = useState(data?.name || '');
  const [color, setColor] = useState(data?.color || '#6b7280');
  const [type, setType] = useState(data?.type || 'both');
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#6b7280', '#14b8a6'];
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} catégorie</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nom</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Couleur</label><div style={{ display: 'flex', gap: 8, marginTop: 8 }}>{colors.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 6, background: c, border: color === c ? '3px solid white' : 'none', boxShadow: color === c ? `0 0 0 2px ${theme.primary}` : 'none', cursor: 'pointer' }} />)}</div></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recettes</option><option value="expense">Dépenses</option><option value="both">Les deux</option></select></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (name) onSave({ name, color, type }); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// === PARTIE 4b - COLLER DIRECTEMENT APRÈS LA PARTIE 4a ===

function PwdForm({ onSave, onClose, currentPwd, theme }) {
  const [old, setOld] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const submit = () => {
    if (old !== currentPwd) { setErr('Ancien mot de passe incorrect'); return; }
    if (pwd.length < 6) { setErr('Min 6 caractères'); return; }
    if (pwd !== confirm) { setErr('Les mots de passe ne correspondent pas'); return; }
    onSave(pwd);
  };
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Modifier mot de passe</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Ancien</label><input type="password" value={old} onChange={e => setOld(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nouveau</label><input type="password" value={pwd} onChange={e => setPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Confirmer</label><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        {err && <p style={{ color: '#dc2626', margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Modifier</button>
        </div>
      </div>
    </div>
  );
}

function DelAccForm({ onConfirm, onClose, theme }) {
  const [text, setText] = useState('');
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Supprimer mon compte</h2>
      <p style={{ color: '#dc2626', background: '#fef2f2', padding: 14, borderRadius: 8, marginBottom: 16 }}>⚠️ Action irréversible !</p>
      <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Tapez "SUPPRIMER"</label><input value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
        <button onClick={onConfirm} disabled={text !== 'SUPPRIMER'} style={{ padding: '12px 20px', background: text === 'SUPPRIMER' ? '#dc2626' : '#ccc', color: 'white', border: 'none', borderRadius: 8, cursor: text === 'SUPPRIMER' ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Supprimer</button>
      </div>
    </div>
  );
}

function WidgetsForm({ widgets, onSave, onClose, theme }) {
  const [w, setW] = useState([...widgets]);
  const toggle = (id) => setW(w.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x));
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Personnaliser le tableau de bord</h2>
      <p style={{ fontSize: 13, color: theme.textSec, marginBottom: 16 }}>Cochez les éléments à afficher sur votre tableau de bord.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {w.map(x => (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: theme.input, borderRadius: 8 }}>
            <input type="checkbox" checked={x.enabled} onChange={() => toggle(x.id)} />
            <span style={{ color: theme.text }}>{x.name}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
        <button onClick={() => { onSave(w); onClose(); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
      </div>
    </div>
  );
}

function CommentForm({ project, onSave, onDelete, onClose, theme, currentUser, isAdmin }) {
  const [text, setText] = useState('');
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>💬 {project.title}</h2>
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
        {(project.comments || []).map(c => (
          <div key={c.id} style={{ background: theme.input, padding: 12, borderRadius: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: theme.text }}>{c.author}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: theme.textMut }}>{new Date(c.date).toLocaleString('fr-FR')}</span>
                {(isAdmin || c.author === currentUser.name) && <button onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, fontSize: 14 }}>🗑️</button>}
              </div>
            </div>
            <p style={{ color: theme.textSec, margin: 0, lineHeight: 1.5 }}>{c.text}</p>
          </div>
        ))}
        {(!project.comments || project.comments.length === 0) && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucun commentaire pour le moment</p>}
      </div>
      <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nouveau commentaire</label><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Votre commentaire..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 80, boxSizing: 'border-box' }} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Fermer</button>
        <button onClick={() => { if (text.trim()) { onSave(text); setText(''); } }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Envoyer</button>
      </div>
    </div>
  );
}
