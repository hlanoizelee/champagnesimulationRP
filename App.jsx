import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCKa9t29e9B6GKUobgvc2t-ff1sech_18g",
  authDomain: "champagne-simulation.firebaseapp.com",
  projectId: "champagne-simulation",
  storageBucket: "champagne-simulation.firebasestorage.app",
  messagingSenderId: "403686403270",
  appId: "1:403686403270:web:6f4642915344357ec9bbc7",
  measurementId: "G-E0G3HRHT99"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const lightTheme = {
  primary: '#7c3238', bg: '#f8fafc', card: '#ffffff', sidebar: '#ffffff',
  header: 'linear-gradient(135deg, #7c3238 0%, #5c2428 100%)',
  input: '#f1f5f9', text: '#1f2937', textSec: '#4b5563', textMut: '#9ca3af', border: '#e5e7eb'
};

const darkTheme = {
  primary: '#9a3c44', bg: '#0f172a', card: '#1e293b', sidebar: '#1e293b',
  header: 'linear-gradient(135deg, #7c3238 0%, #5c2428 100%)',
  input: '#334155', text: '#f1f5f9', textSec: '#94a3b8', textMut: '#64748b', border: '#334155'
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', action: null });
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const theme = darkMode ? darkTheme : lightTheme;
  const isAdmin = currentUser?.role === 'admin';

  // Inactivité
  const updateActivity = useCallback(() => setLastActivity(Date.now()), []);
  
  useEffect(() => {
    if (!isLoggedIn) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        handleLogout();
        alert('Déconnecté pour inactivité.');
      }
    }, 60000);
    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [isLoggedIn, lastActivity, updateActivity]);

  // Chargement données
  useEffect(() => {
    const load = async () => {
      try {
        let usersData = (await getDocs(collection(db, 'users'))).docs.map(d => ({ id: d.id, ...d.data() }));
        if (usersData.length === 0) {
          const admin = { name: 'Administrateur', email: 'admin@csrp.fr', password: 'admin123', role: 'admin', createdAt: new Date().toISOString().split('T')[0] };
          const ref = await addDoc(collection(db, 'users'), admin);
          usersData = [{ id: ref.id, ...admin }];
        }
        setUsers(usersData);
        setTransactions((await getDocs(collection(db, 'transactions'))).docs.map(d => ({ id: d.id, ...d.data() })));
        setProjects((await getDocs(collection(db, 'projects'))).docs.map(d => ({ id: d.id, ...d.data() })));
        setIdeas((await getDocs(collection(db, 'ideas'))).docs.map(d => ({ id: d.id, ...d.data() })));
        
        const catsSnap = await getDocs(collection(db, 'categories'));
        setCategories(catsSnap.docs.length > 0 ? catsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : defaultCategories);
        
        setActivityLog((await getDocs(collection(db, 'activityLog'))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        
        const saved = localStorage.getItem('darkMode');
        if (saved) setDarkMode(JSON.parse(saved));
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  }, []);

  const logActivity = async (action, details) => {
    if (!currentUser) return;
    const entry = { action, details, userName: currentUser.name, timestamp: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, 'activityLog'), entry);
      setActivityLog(prev => [{ id: ref.id, ...entry }, ...prev]);
    } catch (err) { console.error(err); }
  };

  const handleLogin = () => {
    const user = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase().trim());
    if (user && loginPassword === user.password) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      setLoginError('');
      setLastActivity(Date.now());
    } else {
      setLoginError('Email ou mot de passe incorrect');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginEmail('');
    setLoginPassword('');
    setMobileMenuOpen(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', JSON.stringify(!darkMode));
  };

  const showConfirm = (message, action) => setConfirmModal({ show: true, message, action });
  const execConfirm = () => { if (confirmModal.action) confirmModal.action(); setConfirmModal({ show: false, message: '', action: null }); };

  // CRUD
  const saveUser = async (data) => {
    const exists = users.find(u => u.email.toLowerCase() === data.email.toLowerCase() && (!modal.data || u.id !== modal.data.id));
    if (exists) { alert('Email déjà utilisé'); return; }
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'users', modal.data.id), { name: data.name, email: data.email, role: data.role });
        setUsers(users.map(u => u.id === modal.data.id ? { ...u, ...data } : u));
        await logActivity('Modification utilisateur', data.name);
      } else {
        const ref = await addDoc(collection(db, 'users'), { ...data, createdAt: new Date().toISOString().split('T')[0] });
        setUsers([...users, { id: ref.id, ...data, createdAt: new Date().toISOString().split('T')[0] }]);
        await logActivity('Création utilisateur', data.name);
      }
      setModal({ type: null, data: null });
    } catch (err) { console.error(err); }
  };

  const deleteUser = async (id) => {
    const u = users.find(x => x.id === id);
    await deleteDoc(doc(db, 'users', id));
    setUsers(users.filter(x => x.id !== id));
    await logActivity('Suppression utilisateur', u?.name);
  };

  const updatePassword = async (newPwd) => {
    await updateDoc(doc(db, 'users', currentUser.id), { password: newPwd });
    setUsers(users.map(u => u.id === currentUser.id ? { ...u, password: newPwd } : u));
    setCurrentUser({ ...currentUser, password: newPwd });
    setModal({ type: null, data: null });
    alert('Mot de passe modifié !');
  };

  const deleteMyAccount = async () => {
    await deleteDoc(doc(db, 'users', currentUser.id));
    handleLogout();
    alert('Compte supprimé.');
  };

  const saveTransaction = async (data) => {
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'transactions', modal.data.id), data);
        setTransactions(transactions.map(t => t.id === modal.data.id ? { ...data, id: modal.data.id } : t));
        await logActivity('Modification transaction', `${data.description} - ${data.amount}€`);
      } else {
        const ref = await addDoc(collection(db, 'transactions'), data);
        setTransactions([...transactions, { id: ref.id, ...data }]);
        await logActivity('Nouvelle transaction', `${data.description} - ${data.amount}€`);
      }
      setModal({ type: null, data: null });
    } catch (err) { console.error(err); }
  };

  const deleteTransaction = async (id) => {
    const t = transactions.find(x => x.id === id);
    await deleteDoc(doc(db, 'transactions', id));
    setTransactions(transactions.filter(x => x.id !== id));
    await logActivity('Suppression transaction', t?.description);
  };

  const saveProject = async (data) => {
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'projects', modal.data.id), data);
        setProjects(projects.map(p => p.id === modal.data.id ? { ...data, id: modal.data.id } : p));
        await logActivity('Modification projet', data.title);
      } else {
        const ref = await addDoc(collection(db, 'projects'), data);
        setProjects([...projects, { id: ref.id, ...data }]);
        await logActivity('Nouveau projet', data.title);
      }
      setModal({ type: null, data: null });
    } catch (err) { console.error(err); }
  };

  const deleteProject = async (id) => {
    const p = projects.find(x => x.id === id);
    await deleteDoc(doc(db, 'projects', id));
    setProjects(projects.filter(x => x.id !== id));
    await logActivity('Suppression projet', p?.title);
  };

  const saveIdea = async (data) => {
    try {
      if (modal.data) {
        await updateDoc(doc(db, 'ideas', modal.data.id), data);
        setIdeas(ideas.map(i => i.id === modal.data.id ? { ...data, id: modal.data.id } : i));
        await logActivity('Modification idée', data.title);
      } else {
        const newIdea = { ...data, author: currentUser.name, date: new Date().toISOString().split('T')[0], votes: 0 };
        const ref = await addDoc(collection(db, 'ideas'), newIdea);
        setIdeas([...ideas, { id: ref.id, ...newIdea }]);
        await logActivity('Nouvelle idée', data.title);
      }
      setModal({ type: null, data: null });
    } catch (err) { console.error(err); }
  };

  const deleteIdea = async (id) => {
    const i = ideas.find(x => x.id === id);
    await deleteDoc(doc(db, 'ideas', id));
    setIdeas(ideas.filter(x => x.id !== id));
    await logActivity('Suppression idée', i?.title);
  };

  const voteIdea = async (id) => {
    const idea = ideas.find(i => i.id === id);
    const newVotes = (idea.votes || 0) + 1;
    await updateDoc(doc(db, 'ideas', id), { votes: newVotes });
    setIdeas(ideas.map(i => i.id === id ? { ...i, votes: newVotes } : i));
  };

  const saveCategory = async (data) => {
    try {
      if (modal.data?.id && !modal.data.id.startsWith('cat')) {
        await updateDoc(doc(db, 'categories', modal.data.id), data);
        setCategories(categories.map(c => c.id === modal.data.id ? { ...data, id: modal.data.id } : c));
        await logActivity('Modification catégorie', data.name);
      } else {
        const ref = await addDoc(collection(db, 'categories'), data);
        setCategories([...categories, { id: ref.id, ...data }]);
        await logActivity('Nouvelle catégorie', data.name);
      }
      setModal({ type: null, data: null });
    } catch (err) { console.error(err); }
  };

  const deleteCategory = async (id) => {
    if (id.startsWith('cat')) {
      setCategories(categories.filter(c => c.id !== id));
    } else {
      const c = categories.find(x => x.id === id);
      await deleteDoc(doc(db, 'categories', id));
      setCategories(categories.filter(x => x.id !== id));
      await logActivity('Suppression catégorie', c?.name);
    }
  };

  const exportCSV = () => {
    const rows = [['Date', 'Type', 'Catégorie', 'Description', 'Montant']];
    filteredTransactions.forEach(t => {
      rows.push([new Date(t.date).toLocaleDateString('fr-FR'), t.type === 'income' ? 'Recette' : 'Dépense', t.category, t.description, `${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}€`]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Filtres
  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterDateFrom && t.date < filterDateFrom) return false;
    if (filterDateTo && t.date > filterDateTo) return false;
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredProjects = projects.filter(p => !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.description?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredIdeas = ideas.filter(i => !searchTerm || i.title.toLowerCase().includes(searchTerm.toLowerCase()) || i.description?.toLowerCase().includes(searchTerm.toLowerCase()));

  // Stats
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const projectsInProgress = projects.filter(p => p.status === 'in_progress').length;

  // Graphique data
  const getChartData = () => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.toLocaleDateString('fr-FR', { month: 'short' });
      const year = d.getFullYear();
      const key = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const income = transactions.filter(t => t.type === 'income' && t.date?.startsWith(key)).reduce((s, t) => s + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(key)).reduce((s, t) => s + t.amount, 0);
      data.push({ month, income, expense });
    }
    return data;
  };

  const resetFilters = () => { setSearchTerm(''); setFilterType('all'); setFilterCategory('all'); setFilterDateFrom(''); setFilterDateTo(''); };

  // Loading
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg }}>
      <p style={{ color: theme.text }}>Chargement...</p>
    </div>
  );

  // Login
  if (!isLoggedIn) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: 20 }}>
      <div style={{ background: theme.card, borderRadius: 20, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.primary }}><span style={{ fontSize: 34 }}>C</span>HAMPAGNE</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.primary, letterSpacing: 6 }}>SIMULATION</div>
        </div>
        <h2 style={{ textAlign: 'center', color: theme.text, fontSize: 18, marginBottom: 30 }}>Espace Administration</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Email</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: `2px solid ${theme.border}`, fontSize: 15, marginTop: 6, background: theme.input, color: theme.text, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Mot de passe</label>
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: `2px solid ${theme.border}`, fontSize: 15, marginTop: 6, background: theme.input, color: theme.text, boxSizing: 'border-box' }} />
          </div>
          {loginError && <p style={{ color: '#dc2626', textAlign: 'center', margin: 0 }}>{loginError}</p>}
          <button onClick={handleLogin} style={{ padding: 16, background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}>Se connecter</button>
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: theme.textMut, textAlign: 'center' }}>Contactez un administrateur pour obtenir vos accès</p>
        <p style={{ marginTop: 12, fontSize: 11, color: theme.textMut, textAlign: 'center', background: theme.input, padding: 12, borderRadius: 8 }}>
          En vous connectant, vous acceptez que vos données soient stockées pour la gestion interne de l'association.
        </p>
        <button onClick={toggleDarkMode} style={{ marginTop: 16, background: 'none', border: 'none', color: theme.textMut, cursor: 'pointer', width: '100%' }}>
          {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
        </button>
      </div>
    </div>
  );

  // App principale
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: theme.header, color: 'white', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: 'none', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 22, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }} className="mobile-menu-btn">☰</button>
          <div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ fontSize: 22 }}>C</span>HAMPAGNE <span style={{ fontWeight: 600, opacity: 0.9 }}>SIMULATION</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="user-info-desktop" style={{ textAlign: 'right', marginRight: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{currentUser.name}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{isAdmin ? 'Administrateur' : 'Lecteur'}</div>
          </div>
          <button onClick={toggleDarkMode} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>{darkMode ? '☀️' : '🌙'}</button>
          <button onClick={() => setModal({ type: 'password', data: null })} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>🔑</button>
          <button onClick={() => setModal({ type: 'deleteAccount', data: null })} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.3)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer' }}>🗑️</button>
          <button onClick={handleLogout} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Déconnexion</button>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* Sidebar */}
        <nav className={`sidebar ${mobileMenuOpen ? 'open' : ''}`} style={{ width: 220, background: theme.sidebar, borderRight: `1px solid ${theme.border}`, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'dashboard', icon: '📊', label: 'Tableau de bord' },
            { id: 'finances', icon: '💰', label: 'Finances' },
            { id: 'projects', icon: '📁', label: 'Projets' },
            { id: 'ideas', icon: '💡', label: 'Boîte à idées' },
            ...(isAdmin ? [
              { id: 'users', icon: '👥', label: 'Utilisateurs' },
              { id: 'categories', icon: '🏷️', label: 'Catégories' },
              { id: 'history', icon: '📜', label: 'Historique' }
            ] : [])
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); setSearchTerm(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: activeTab === item.id ? 'linear-gradient(135deg, #7c3238, #9a3c44)' : 'transparent', 
                color: activeTab === item.id ? 'white' : theme.text, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'left', width: '100%' }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />}

        {/* Main */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 24 }}>Tableau de bord</h1>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Solde actuel', value: `${balance.toFixed(2)} €`, icon: '💶', color: theme.primary },
                  { label: 'Total recettes', value: `${totalIncome.toFixed(2)} €`, icon: '📈', color: '#10b981' },
                  { label: 'Total dépenses', value: `${totalExpense.toFixed(2)} €`, icon: '📉', color: '#ef4444' },
                  { label: 'Projets en cours', value: projectsInProgress, icon: '🚀', color: '#3b82f6' }
                ].map((stat, i) => (
                  <div key={i} style={{ background: theme.card, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: stat.color }}>
                    <span style={{ fontSize: 28 }}>{stat.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, color: theme.textSec }}>{stat.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{stat.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Graphique */}
              <div style={{ background: theme.card, borderRadius: 12, padding: 20, marginBottom: 24, border: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, marginBottom: 16 }}>Évolution (6 derniers mois)</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 180, gap: 8 }}>
                  {getChartData().map((d, i) => {
                    const max = Math.max(...getChartData().map(x => Math.max(x.income, x.expense)), 1);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140 }}>
                          <div style={{ width: 20, background: '#10b981', borderRadius: '4px 4px 0 0', height: `${(d.income / max) * 100}%`, minHeight: d.income > 0 ? 4 : 0 }} title={`Recettes: ${d.income.toFixed(2)}€`} />
                          <div style={{ width: 20, background: '#ef4444', borderRadius: '4px 4px 0 0', height: `${(d.expense / max) * 100}%`, minHeight: d.expense > 0 ? 4 : 0 }} title={`Dépenses: ${d.expense.toFixed(2)}€`} />
                        </div>
                        <span style={{ fontSize: 11, color: theme.textMut, marginTop: 8 }}>{d.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textSec }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 3 }} /> Recettes</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textSec }}><span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 3 }} /> Dépenses</span>
                </div>
              </div>

              {/* Résumés */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <div style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${theme.border}` }}>Dernières transactions</h3>
                  {transactions.slice(-5).reverse().map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: theme.input, borderRadius: 6, marginBottom: 8 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 4, background: t.type === 'income' ? '#10b981' : '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{t.type === 'income' ? '+' : '-'}</span>
                      <span style={{ flex: 1, fontSize: 14, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</span>
                      <span style={{ fontWeight: 600, color: t.type === 'income' ? '#10b981' : '#ef4444', fontSize: 14 }}>{t.type === 'income' ? '+' : '-'}{t.amount?.toFixed(2)}€</span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucune transaction</p>}
                </div>
                <div style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${theme.border}` }}>Projets en cours</h3>
                  {projects.filter(p => p.status === 'in_progress' || p.status === 'planning').slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: theme.input, borderRadius: 6, marginBottom: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[p.status] }} />
                      <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{p.title}</span>
                      <span style={{ fontSize: 12, color: theme.textMut }}>{statusLabels[p.status]}</span>
                    </div>
                  ))}
                  {projects.filter(p => p.status === 'in_progress' || p.status === 'planning').length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucun projet en cours</p>}
                </div>
              </div>
            </div>
          )}

          {/* Finances */}
          {activeTab === 'finances' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Finances</h1>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={exportCSV} style={{ padding: '10px 16px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>📥 Exporter CSV</button>
                  {isAdmin && <button onClick={() => setModal({ type: 'transaction', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+ Nouvelle transaction</button>}
                </div>
              </div>

              {/* Filtres */}
              <div style={{ background: theme.card, borderRadius: 12, padding: 16, marginBottom: 20, border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14 }}>
                    <option value="all">Tous types</option>
                    <option value="income">Recettes</option>
                    <option value="expense">Dépenses</option>
                  </select>
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14 }}>
                    <option value="all">Toutes catégories</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14 }} />
                  <span style={{ color: theme.textMut }}>au</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14 }} />
                  <button onClick={resetFilters} style={{ padding: '10px 16px', background: 'none', border: 'none', color: theme.primary, cursor: 'pointer', fontSize: 14 }}>Réinitialiser</button>
                </div>
              </div>

              {/* Résumé */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 30, padding: 20, background: theme.card, borderRadius: 12, marginBottom: 20, border: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.textSec }}>Recettes</div><div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{totalIncome.toFixed(2)} €</div></div>
                <div style={{ fontSize: 24, color: theme.textMut }}>-</div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.textSec }}>Dépenses</div><div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{totalExpense.toFixed(2)} €</div></div>
                <div style={{ fontSize: 24, color: theme.textMut }}>=</div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: theme.textSec }}>Solde</div><div style={{ fontSize: 24, fontWeight: 700, color: balance >= 0 ? '#10b981' : '#ef4444' }}>{balance.toFixed(2)} €</div></div>
              </div>

              {/* Table */}
              <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr>
                      {['Date', 'Type', 'Catégorie', 'Description', 'Montant', ...(isAdmin ? ['Actions'] : [])].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: 14, background: theme.input, fontWeight: 600, fontSize: 12, color: theme.textSec, textTransform: 'uppercase', borderBottom: `2px solid ${theme.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => {
                      const cat = categories.find(c => c.name === t.category);
                      return (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: 14, color: theme.text, fontSize: 14 }}>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                          <td style={{ padding: 14 }}><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: t.type === 'income' ? '#dcfce7' : '#fee2e2', color: t.type === 'income' ? '#166534' : '#991b1b' }}>{t.type === 'income' ? 'Recette' : 'Dépense'}</span></td>
                          <td style={{ padding: 14 }}><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, color: 'white', background: cat?.color || '#6b7280' }}>{t.category}</span></td>
                          <td style={{ padding: 14, color: theme.text, fontSize: 14 }}>{t.description}</td>
                          <td style={{ padding: 14, fontWeight: 600, fontFamily: 'monospace', fontSize: 15, color: t.type === 'income' ? '#10b981' : '#ef4444' }}>{t.type === 'income' ? '+' : '-'}{t.amount?.toFixed(2)} €</td>
                          {isAdmin && (
                            <td style={{ padding: 14 }}>
                              <button onClick={() => setModal({ type: 'transaction', data: t })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>✏️</button>
                              <button onClick={() => showConfirm('Supprimer cette transaction ?', () => deleteTransaction(t.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>🗑️</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTransactions.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucune transaction trouvée</p>}
              </div>
            </div>
          )}

          {/* Projets */}
          {activeTab === 'projects' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Projets</h1>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      style={{ padding: '10px 10px 10px 38px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14 }} />
                  </div>
                  {isAdmin && <button onClick={() => setModal({ type: 'project', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+ Nouveau projet</button>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {filteredProjects.map(p => (
                  <div key={p.id} style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <span style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'white', background: statusColors[p.status] }}>{statusLabels[p.status]}</span>
                      {isAdmin && (
                        <div>
                          <button onClick={() => setModal({ type: 'project', data: p })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>✏️</button>
                          <button onClick={() => showConfirm('Supprimer ce projet ?', () => deleteProject(p.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>🗑️</button>
                        </div>
                      )}
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 10 }}>{p.title}</h3>
                    <p style={{ fontSize: 14, color: theme.textSec, marginBottom: 14, lineHeight: 1.5 }}>{p.description}</p>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: theme.textMut, marginBottom: 10 }}>
                      <span>👤 {p.responsible}</span>
                      {p.deadline && <span>📅 {new Date(p.deadline).toLocaleDateString('fr-FR')}</span>}
                    </div>
                    {p.notes && <p style={{ fontSize: 13, color: theme.primary, background: '#fef2f2', padding: 10, borderRadius: 6, fontStyle: 'italic' }}>📝 {p.notes}</p>}
                  </div>
                ))}
              </div>
              {filteredProjects.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucun projet trouvé</p>}
            </div>
          )}

          {/* Idées */}
          {activeTab === 'ideas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Boîte à idées</h1>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                    <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      style={{ padding: '10px 10px 10px 38px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, fontSize: 14 }} />
                  </div>
                  <button onClick={() => setModal({ type: 'idea', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+ Proposer une idée</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {filteredIdeas.sort((a, b) => (b.votes || 0) - (a.votes || 0)).map(i => (
                  <div key={i.id} style={{ background: theme.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: theme.textSec }}>💡 {i.author}</span>
                      {isAdmin && (
                        <div>
                          <button onClick={() => setModal({ type: 'idea', data: i })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>✏️</button>
                          <button onClick={() => showConfirm('Supprimer cette idée ?', () => deleteIdea(i.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>🗑️</button>
                        </div>
                      )}
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 10 }}>{i.title}</h3>
                    <p style={{ fontSize: 14, color: theme.textSec, marginBottom: 14, lineHeight: 1.5 }}>{i.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                      <span style={{ fontSize: 12, color: theme.textMut }}>{new Date(i.date).toLocaleDateString('fr-FR')}</span>
                      <button onClick={() => voteIdea(i.id)} style={{ padding: '8px 14px', background: '#fef2f2', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: theme.primary }}>❤️ {i.votes || 0}</button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredIdeas.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucune idée trouvée</p>}
            </div>
          )}

          {/* Utilisateurs */}
          {activeTab === 'users' && isAdmin && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Utilisateurs</h1>
                <button onClick={() => setModal({ type: 'user', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+ Nouvel utilisateur</button>
              </div>
              <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>
                      {['Nom', 'Email', 'Rôle', 'Date création', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: 14, background: theme.input, fontWeight: 600, fontSize: 12, color: theme.textSec, textTransform: 'uppercase', borderBottom: `2px solid ${theme.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: 14, color: theme.text }}>{u.name}</td>
                        <td style={{ padding: 14, color: theme.text }}>{u.email}</td>
                        <td style={{ padding: 14 }}><span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'white', background: u.role === 'admin' ? '#7c3238' : '#64748b' }}>{u.role === 'admin' ? 'Admin' : 'Lecteur'}</span></td>
                        <td style={{ padding: 14, color: theme.text }}>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: 14 }}>
                          <button onClick={() => setModal({ type: 'user', data: u })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>✏️</button>
                          <button onClick={() => showConfirm('Supprimer cet utilisateur ?', () => deleteUser(u.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }} disabled={u.id === currentUser.id}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Catégories */}
          {activeTab === 'categories' && isAdmin && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text }}>Catégories</h1>
                <button onClick={() => setModal({ type: 'category', data: null })} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+ Nouvelle catégorie</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                {categories.map(c => (
                  <div key={c.id} style={{ background: theme.card, borderRadius: 12, padding: 16, border: `1px solid ${theme.border}`, borderLeftWidth: 4, borderLeftColor: c.color }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: c.color }} />
                        <span style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>{c.name}</span>
                      </div>
                      <div>
                        <button onClick={() => setModal({ type: 'category', data: c })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>✏️</button>
                        <button onClick={() => showConfirm('Supprimer cette catégorie ?', () => deleteCategory(c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: theme.textMut }}>{c.type === 'income' ? '📈 Recettes' : c.type === 'expense' ? '📉 Dépenses' : '📊 Les deux'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique */}
          {activeTab === 'history' && isAdmin && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 20 }}>Historique des actions</h1>
              <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>
                      {['Date/Heure', 'Utilisateur', 'Action', 'Détails'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: 14, background: theme.input, fontWeight: 600, fontSize: 12, color: theme.textSec, textTransform: 'uppercase', borderBottom: `2px solid ${theme.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activityLog.map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: 14, color: theme.text, fontSize: 13 }}>{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                        <td style={{ padding: 14, color: theme.text }}>{log.userName}</td>
                        <td style={{ padding: 14, color: theme.text }}>{log.action}</td>
                        <td style={{ padding: 14, color: theme.textSec }}>{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {activityLog.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 40 }}>Aucune activité enregistrée</p>}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modales */}
      {modal.type && (
        <div onClick={() => setModal({ type: null, data: null })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 450, maxHeight: '90vh', overflowY: 'auto' }}>
            {modal.type === 'user' && <UserForm data={modal.data} onSave={saveUser} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'transaction' && <TransactionForm data={modal.data} onSave={saveTransaction} onClose={() => setModal({ type: null, data: null })} categories={categories} theme={theme} />}
            {modal.type === 'project' && <ProjectForm data={modal.data} onSave={saveProject} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'idea' && <IdeaForm data={modal.data} onSave={saveIdea} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'category' && <CategoryForm data={modal.data} onSave={saveCategory} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
            {modal.type === 'password' && <PasswordForm onSave={updatePassword} onClose={() => setModal({ type: null, data: null })} currentPwd={currentUser.password} theme={theme} />}
            {modal.type === 'deleteAccount' && <DeleteAccountForm onConfirm={deleteMyAccount} onClose={() => setModal({ type: null, data: null })} theme={theme} />}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div onClick={() => setConfirmModal({ show: false, message: '', action: null })} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: theme.text, marginBottom: 24 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setConfirmModal({ show: false, message: '', action: null })} style={{ padding: '12px 24px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
              <button onClick={execConfirm} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Styles responsives */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
          .user-info-desktop { display: none !important; }
          .sidebar { position: fixed; top: 56px; left: 0; bottom: 0; transform: translateX(-100%); z-index: 60; transition: transform 0.3s; }
          .sidebar.open { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// Formulaires
function UserForm({ data, onSave, onClose, theme }) {
  const [name, setName] = useState(data?.name || '');
  const [email, setEmail] = useState(data?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(data?.role || 'reader');
  const isEdit = !!data;

  const submit = () => {
    if (!name || !email || (!isEdit && !password)) return;
    onSave(isEdit ? { name, email, role } : { name, email, password, role });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{isEdit ? 'Modifier' : 'Nouvel'} utilisateur</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nom</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        {!isEdit && <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Mot de passe</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>}
        {isEdit && <p style={{ fontSize: 13, color: theme.textSec, background: theme.input, padding: 12, borderRadius: 8 }}>ℹ️ Seul l'utilisateur peut modifier son mot de passe</p>}
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Rôle</label><select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="admin">Administrateur</option><option value="reader">Lecteur</option></select></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function TransactionForm({ data, onSave, onClose, categories, theme }) {
  const [date, setDate] = useState(data?.date || new Date().toISOString().split('T')[0]);
  const [type, setType] = useState(data?.type || 'expense');
  const [category, setCategory] = useState(data?.category || 'Autre');
  const [description, setDescription] = useState(data?.description || '');
  const [amount, setAmount] = useState(data?.amount || '');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const filteredCats = categories.filter(c => c.type === 'both' || c.type === type);
  
  const submit = async () => {
    if (!description || !amount) return;
    setUploading(true);
    await onSave({ date, type, category, description, amount: parseFloat(amount), attachmentUrl: data?.attachmentUrl, attachmentName: data?.attachmentName }, file);
    setUploading(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} transaction</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recette</option><option value="expense">Dépense</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Catégorie</label><select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}>{filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><input value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Montant (€)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div>
          <label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Pièce jointe</label>
          {data?.attachmentUrl && <p style={{ fontSize: 12, color: theme.textSec, marginTop: 4 }}>Actuel : <a href={data.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.primary }}>{data.attachmentName || 'Voir'}</a></p>}
          <input type="file" onChange={e => setFile(e.target.files[0])} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} />
          <p style={{ fontSize: 11, color: theme.textMut, marginTop: 4 }}>Formats acceptés : PDF, images, documents</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} disabled={uploading} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: uploading ? 0.7 : 1 }}>{uploading ? 'Envoi...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}

function RecurringForm({ data, onSave, onClose, categories, theme }) {
  const [type, setType] = useState(data?.type || 'expense');
  const [category, setCategory] = useState(data?.category || 'Autre');
  const [description, setDescription] = useState(data?.description || '');
  const [amount, setAmount] = useState(data?.amount || '');
  const [dayOfMonth, setDayOfMonth] = useState(data?.dayOfMonth || 1);
  const [active, setActive] = useState(data?.active !== false);
  const filteredCats = categories.filter(c => c.type === 'both' || c.type === type);
  
  const submit = () => {
    if (!description || !amount) return;
    onSave({ type, category, description, amount: parseFloat(amount), dayOfMonth: parseInt(dayOfMonth), active });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} récurrence</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recette</option><option value="expense">Dépense</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Catégorie</label><select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}>{filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Abonnement serveur" style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Montant (€)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Jour du mois</label><input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /><p style={{ fontSize: 11, color: theme.textMut, marginTop: 4 }}>Entre 1 et 28 pour éviter les problèmes de fin de mois</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} id="active" />
          <label htmlFor="active" style={{ fontSize: 14, color: theme.text }}>Activer cette récurrence</label>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function ProjectForm({ data, onSave, onClose, theme }) {
  const [title, setTitle] = useState(data?.title || '');
  const [status, setStatus] = useState(data?.status || 'planning');
  const [responsible, setResponsible] = useState(data?.responsible || '');
  const [description, setDescription] = useState(data?.description || '');
  const [deadline, setDeadline] = useState(data?.deadline || '');
  const [notes, setNotes] = useState(data?.notes || '');
  const submit = () => { if (!title || !responsible || !description) return; onSave({ title, status, responsible, description, deadline, notes }); };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouveau'} projet</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Titre</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Statut</label><select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="planning">En réflexion</option><option value="in_progress">En cours</option><option value="completed">Terminé</option><option value="abandoned">Abandonné</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Responsable</label><input value={responsible} onChange={e => setResponsible(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Échéance</label><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function IdeaForm({ data, onSave, onClose, theme }) {
  const [title, setTitle] = useState(data?.title || '');
  const [description, setDescription] = useState(data?.description || '');
  const submit = () => { if (!title || !description) return; onSave({ title, description }); };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Proposer une'} idée</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Titre</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez votre idée..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 100, resize: 'vertical', boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Proposer</button>
        </div>
      </div>
    </div>
  );
}

function CategoryForm({ data, onSave, onClose, theme }) {
  const [name, setName] = useState(data?.name || '');
  const [color, setColor] = useState(data?.color || '#6b7280');
  const [type, setType] = useState(data?.type || 'both');
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#6b7280', '#14b8a6', '#f97316'];
  const submit = () => { if (!name) return; onSave({ name, color, type }); };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} catégorie</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nom</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Couleur</label><div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{colors.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 6, background: c, border: color === c ? '3px solid white' : 'none', boxShadow: color === c ? `0 0 0 2px ${theme.primary}` : 'none', cursor: 'pointer' }} />)}</div></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recettes</option><option value="expense">Dépenses</option><option value="both">Les deux</option></select></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function PasswordForm({ onSave, onClose, currentPwd, theme }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (oldPwd !== currentPwd) { setError('Ancien mot de passe incorrect'); return; }
    if (newPwd.length < 6) { setError('Min 6 caractères'); return; }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas'); return; }
    onSave(newPwd);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Modifier mot de passe</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Ancien mot de passe</label><input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nouveau mot de passe</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Confirmer</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Modifier</button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountForm({ onConfirm, onClose, theme }) {
  const [text, setText] = useState('');
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Supprimer mon compte</h2>
      <p style={{ color: '#dc2626', background: '#fef2f2', padding: 14, borderRadius: 8, marginBottom: 16 }}>⚠️ Cette action est irréversible !</p>
      <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Tapez "SUPPRIMER" pour confirmer</label><input value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
        <button onClick={onConfirm} disabled={text !== 'SUPPRIMER'} style={{ padding: '12px 20px', background: text === 'SUPPRIMER' ? 'linear-gradient(135deg, #dc2626, #ef4444)' : '#ccc', color: 'white', border: 'none', borderRadius: 8, cursor: text === 'SUPPRIMER' ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Supprimer</button>
      </div>
    </div>
  );
}

function DashboardSettingsForm({ widgets, onSave, onClose, theme }) {
  const [localWidgets, setLocalWidgets] = useState([...widgets]);
  const toggle = (id) => {
    setLocalWidgets(localWidgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Personnaliser le tableau de bord</h2>
      <p style={{ fontSize: 14, color: theme.textSec, marginBottom: 16 }}>Choisissez les éléments à afficher sur votre tableau de bord.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {localWidgets.map(w => (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: theme.input, borderRadius: 8 }}>
            <input type="checkbox" checked={w.enabled} onChange={() => toggle(w.id)} id={w.id} />
            <label htmlFor={w.id} style={{ fontSize: 14, color: theme.text, cursor: 'pointer' }}>{w.name}</label>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
        <button onClick={() => { onSave(localWidgets); onClose(); }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
      </div>
    </div>
  );
}

function CommentForm({ project, onSave, onDelete, onClose, theme, currentUser, isAdmin }) {
  const [text, setText] = useState('');
  const comments = project.comments || [];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Commentaires - {project.title}</h2>
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
        {comments.length === 0 && <p style={{ color: theme.textMut, textAlign: 'center', padding: 20 }}>Aucun commentaire</p>}
        {comments.map(c => (
          <div key={c.id} style={{ background: theme.input, padding: 12, borderRadius: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: theme.text, fontSize: 14 }}>{c.author}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: theme.textMut, fontSize: 12 }}>{new Date(c.date).toLocaleDateString('fr-FR')}</span>
                {(isAdmin || c.author === currentUser.name) && <button onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 }}>🗑️</button>}
              </div>
            </div>
            <p style={{ color: theme.textSec, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{c.text}</p>
          </div>
        ))}
      </div>
      <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nouveau commentaire</label><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Votre commentaire..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Fermer</button>
        <button onClick={() => { if (text.trim()) onSave(text); }} disabled={!text.trim()} style={{ padding: '12px 20px', background: text.trim() ? 'linear-gradient(135deg, #7c3238, #9a3c44)' : '#ccc', color: 'white', border: 'none', borderRadius: 8, cursor: text.trim() ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Envoyer</button>
      </div>
    </div>
  );
} color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        {!isEdit && <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Mot de passe</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>}
        {isEdit && <p style={{ fontSize: 13, color: theme.textSec, background: theme.input, padding: 12, borderRadius: 8 }}>ℹ️ Seul l'utilisateur peut modifier son mot de passe</p>}
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Rôle</label><select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="admin">Administrateur</option><option value="reader">Lecteur</option></select></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function TransactionForm({ data, onSave, onClose, categories, theme }) {
  const [date, setDate] = useState(data?.date || new Date().toISOString().split('T')[0]);
  const [type, setType] = useState(data?.type || 'expense');
  const [category, setCategory] = useState(data?.category || 'Autre');
  const [description, setDescription] = useState(data?.description || '');
  const [amount, setAmount] = useState(data?.amount || '');

  const filteredCats = categories.filter(c => c.type === 'both' || c.type === type);

  const submit = () => {
    if (!description || !amount) return;
    onSave({ date, type, category, description, amount: parseFloat(amount) });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} transaction</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recette</option><option value="expense">Dépense</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Catégorie</label><select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}>{filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><input value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Montant (€)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function ProjectForm({ data, onSave, onClose, theme }) {
  const [title, setTitle] = useState(data?.title || '');
  const [status, setStatus] = useState(data?.status || 'planning');
  const [responsible, setResponsible] = useState(data?.responsible || '');
  const [description, setDescription] = useState(data?.description || '');
  const [deadline, setDeadline] = useState(data?.deadline || '');
  const [notes, setNotes] = useState(data?.notes || '');

  const submit = () => {
    if (!title || !responsible || !description) return;
    onSave({ title, status, responsible, description, deadline, notes });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouveau'} projet</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Titre</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Statut</label><select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="planning">En réflexion</option><option value="in_progress">En cours</option><option value="completed">Terminé</option><option value="abandoned">Abandonné</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Responsable</label><input value={responsible} onChange={e => setResponsible(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Échéance</label><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function IdeaForm({ data, onSave, onClose, theme }) {
  const [title, setTitle] = useState(data?.title || '');
  const [description, setDescription] = useState(data?.description || '');

  const submit = () => {
    if (!title || !description) return;
    onSave({ title, description });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Proposer une'} idée</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Titre</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez votre idée..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 100, resize: 'vertical', boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Proposer</button>
        </div>
      </div>
    </div>
  );
}

function CategoryForm({ data, onSave, onClose, theme }) {
  const [name, setName] = useState(data?.name || '');
  const [color, setColor] = useState(data?.color || '#6b7280');
  const [type, setType] = useState(data?.type || 'both');
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#6b7280', '#14b8a6', '#f97316'];

  const submit = () => {
    if (!name) return;
    onSave({ name, color, type });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} catégorie</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nom</label><input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Couleur</label><div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{colors.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 6, background: c, border: color === c ? '3px solid white' : 'none', boxShadow: color === c ? `0 0 0 2px ${theme.primary}` : 'none', cursor: 'pointer' }} />)}</div></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recettes</option><option value="expense">Dépenses</option><option value="both">Les deux</option></select></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function PasswordForm({ onSave, onClose, currentPwd, theme }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (oldPwd !== currentPwd) { setError('Ancien mot de passe incorrect'); return; }
    if (newPwd.length < 6) { setError('Min 6 caractères'); return; }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas'); return; }
    onSave(newPwd);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Modifier mot de passe</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Ancien mot de passe</label><input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nouveau mot de passe</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Confirmer</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Modifier</button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountForm({ onConfirm, onClose, theme }) {
  const [text, setText] = useState('');

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Supprimer mon compte</h2>
      <p style={{ color: '#dc2626', background: '#fef2f2', padding: 14, borderRadius: 8, marginBottom: 16 }}>⚠️ Cette action est irréversible !</p>
      <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Tapez "SUPPRIMER" pour confirmer</label><input value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
        <button onClick={onConfirm} disabled={text !== 'SUPPRIMER'} style={{ padding: '12px 20px', background: text === 'SUPPRIMER' ? 'linear-gradient(135deg, #dc2626, #ef4444)' : '#ccc', color: 'white', border: 'none', borderRadius: 8, cursor: text === 'SUPPRIMER' ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Supprimer</button>
      </div>
    </div>
  );
}

function RecurringForm({ data, onSave, onClose, categories, theme }) {
  const [type, setType] = useState(data?.type || 'expense');
  const [category, setCategory] = useState(data?.category || 'Autre');
  const [description, setDescription] = useState(data?.description || '');
  const [amount, setAmount] = useState(data?.amount || '');
  const [dayOfMonth, setDayOfMonth] = useState(data?.dayOfMonth || 1);
  const [active, setActive] = useState(data?.active !== false);

  const filteredCats = categories.filter(c => c.type === 'both' || c.type === type);

  const submit = () => {
    if (!description || !amount) return;
    onSave({ type, category, description, amount: parseFloat(amount), dayOfMonth, active });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>{data ? 'Modifier' : 'Nouvelle'} récurrence</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Type</label><select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}><option value="income">Recette</option><option value="expense">Dépense</option></select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Catégorie</label><select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6 }}>{filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Description</label><input value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Montant (€)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Jour du mois (1-28)</label><input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value))} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, boxSizing: 'border-box' }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><label style={{ color: theme.text }}>Actif</label></div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
          <button onClick={submit} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function DashboardSettingsForm({ widgets, onSave, onClose, theme }) {
  const [w, setW] = useState([...widgets]);
  const toggle = (id) => setW(w.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x));

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Personnaliser le tableau de bord</h2>
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
      <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 20 }}>Commentaires - {project.title}</h2>
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
        {(project.comments || []).map(c => (
          <div key={c.id} style={{ background: theme.input, padding: 12, borderRadius: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: theme.text }}>{c.author}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: theme.textMut }}>{new Date(c.date).toLocaleString('fr-FR')}</span>
                {(isAdmin || c.author === currentUser.name) && <button onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>🗑️</button>}
              </div>
            </div>
            <p style={{ color: theme.textSec, margin: 0 }}>{c.text}</p>
          </div>
        ))}
        {(!project.comments || project.comments.length === 0) && <p style={{ color: theme.textMut, textAlign: 'center' }}>Aucun commentaire</p>}
      </div>
      <div><label style={{ fontSize: 14, fontWeight: 600, color: theme.textSec }}>Nouveau commentaire</label><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Votre commentaire..." style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text, marginTop: 6, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={{ padding: '12px 20px', background: theme.input, color: theme.text, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Fermer</button>
        <button onClick={() => { if (text.trim()) { onSave(text); setText(''); } }} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #7c3238, #9a3c44)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Envoyer</button>
      </div>
    </div>
  );
}
