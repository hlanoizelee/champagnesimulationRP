import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';

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

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const statusLabels = {
  planning: 'En réflexion',
  in_progress: 'En cours',
  completed: 'Terminé',
  abandoned: 'Abandonné'
};

const statusColors = {
  planning: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  abandoned: '#6b7280'
};

const categoryColors = {
  'Cotisations': '#10b981',
  'Dons': '#8b5cf6',
  'Partenariats': '#3b82f6',
  'Serveurs': '#ef4444',
  'Outils': '#f59e0b',
  'Événements': '#ec4899',
  'Autre': '#6b7280'
};

export default function ChampagneSimulationApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // États des modales
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  // Charger les données depuis Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les utilisateurs
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Si aucun utilisateur, créer l'admin par défaut
        if (usersData.length === 0) {
          const defaultAdmin = {
            name: 'Administrateur',
            email: 'admin@csrp.fr',
            password: 'admin123',
            role: 'admin',
            createdAt: new Date().toISOString().split('T')[0]
          };
          const docRef = await addDoc(collection(db, 'users'), defaultAdmin);
          usersData.push({ id: docRef.id, ...defaultAdmin });
        }
        setUsers(usersData);

        // Charger les transactions
        const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
        setTransactions(transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Charger les projets
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        setProjects(projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Charger les idées
        const ideasSnapshot = await getDocs(collection(db, 'ideas'));
        setIdeas(ideasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        setLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleLogin = () => {
    const user = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase().trim());
    if (user && loginPassword === user.password) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Email ou mot de passe incorrect');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginEmail('');
    setLoginPassword('');
  };

  // Calculs financiers
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Stats projets
  const projectsInProgress = projects.filter(p => p.status === 'in_progress').length;

  // CRUD Functions avec Firebase
  const saveUser = async (userData) => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'users', editingItem.id), userData);
        setUsers(users.map(u => u.id === editingItem.id ? { ...userData, id: editingItem.id } : u));
      } else {
        const newUser = { ...userData, createdAt: new Date().toISOString().split('T')[0] };
        const docRef = await addDoc(collection(db, 'users'), newUser);
        setUsers([...users, { id: docRef.id, ...newUser }]);
      }
      setShowUserModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const deleteUser = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const saveTransaction = async (transactionData) => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'transactions', editingItem.id), transactionData);
        setTransactions(transactions.map(t => t.id === editingItem.id ? { ...transactionData, id: editingItem.id } : t));
      } else {
        const docRef = await addDoc(collection(db, 'transactions'), transactionData);
        setTransactions([...transactions, { id: docRef.id, ...transactionData }]);
      }
      setShowTransactionModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const saveProject = async (projectData) => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'projects', editingItem.id), projectData);
        setProjects(projects.map(p => p.id === editingItem.id ? { ...projectData, id: editingItem.id } : p));
      } else {
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        setProjects([...projects, { id: docRef.id, ...projectData }]);
      }
      setShowProjectModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const deleteProject = async (id) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      setProjects(projects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const saveIdea = async (ideaData) => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'ideas', editingItem.id), ideaData);
        setIdeas(ideas.map(i => i.id === editingItem.id ? { ...ideaData, id: editingItem.id } : i));
      } else {
        const newIdea = { 
          ...ideaData, 
          author: currentUser.name, 
          date: new Date().toISOString().split('T')[0], 
          votes: 0 
        };
        const docRef = await addDoc(collection(db, 'ideas'), newIdea);
        setIdeas([...ideas, { id: docRef.id, ...newIdea }]);
      }
      setShowIdeaModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const deleteIdea = async (id) => {
    try {
      await deleteDoc(doc(db, 'ideas', id));
      setIdeas(ideas.filter(i => i.id !== id));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const voteIdea = async (id) => {
    try {
      const idea = ideas.find(i => i.id === id);
      const newVotes = (idea.votes || 0) + 1;
      await updateDoc(doc(db, 'ideas', id), { votes: newVotes });
      setIdeas(ideas.map(i => i.id === id ? { ...i, votes: newVotes } : i));
    } catch (error) {
      console.error('Erreur lors du vote:', error);
    }
  };

  // Écran de chargement
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Chargement...</p>
        </div>
      </div>
    );
  }

  // Page de connexion
  if (!isLoggedIn) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginLogo}>
            <div style={styles.logoText}>
              <span style={styles.logoC}>C</span>HAMPAGNE
            </div>
            <div style={styles.logoSimulation}>SIMULATION</div>
          </div>
          <h2 style={styles.loginTitle}>Espace Administration</h2>
          <div style={styles.loginForm}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                style={styles.input}
                placeholder="votre@email.fr"
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Mot de passe</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                style={styles.input}
                placeholder="••••••••"
              />
            </div>
            {loginError && <p style={styles.error}>{loginError}</p>}
            <button type="button" onClick={handleLogin} style={styles.loginButton}>Se connecter</button>
          </div>
          <p style={styles.hint}>Contactez un administrateur pour obtenir vos accès</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerLogo}>
            <span style={styles.headerLogoC}>C</span>HAMPAGNE
            <span style={styles.headerLogoSim}> SIMULATION</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{currentUser.name}</span>
            <span style={styles.userRole}>{currentUser.role === 'admin' ? 'Administrateur' : 'Lecteur'}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>Déconnexion</button>
        </div>
      </header>

      <div style={styles.container}>
        {/* Sidebar */}
        <nav style={styles.sidebar}>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            style={{...styles.navButton, ...(activeTab === 'dashboard' ? styles.navButtonActive : {})}}
          >
            <span style={styles.navIcon}>📊</span> Tableau de bord
          </button>
          <button 
            onClick={() => setActiveTab('finances')} 
            style={{...styles.navButton, ...(activeTab === 'finances' ? styles.navButtonActive : {})}}
          >
            <span style={styles.navIcon}>💰</span> Finances
          </button>
          <button 
            onClick={() => setActiveTab('projects')} 
            style={{...styles.navButton, ...(activeTab === 'projects' ? styles.navButtonActive : {})}}
          >
            <span style={styles.navIcon}>📁</span> Projets
          </button>
          <button 
            onClick={() => setActiveTab('ideas')} 
            style={{...styles.navButton, ...(activeTab === 'ideas' ? styles.navButtonActive : {})}}
          >
            <span style={styles.navIcon}>💡</span> Boîte à idées
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('users')} 
              style={{...styles.navButton, ...(activeTab === 'users' ? styles.navButtonActive : {})}}
            >
              <span style={styles.navIcon}>👥</span> Utilisateurs
            </button>
          )}
        </nav>

        {/* Main Content */}
        <main style={styles.main}>
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div style={styles.dashboard}>
              <h1 style={styles.pageTitle}>Tableau de bord</h1>
              
              <div style={styles.statsGrid}>
                <div style={{...styles.statCard, ...styles.statCardBalance}}>
                  <div style={styles.statIcon}>💶</div>
                  <div style={styles.statContent}>
                    <span style={styles.statLabel}>Solde actuel</span>
                    <span style={styles.statValue}>{balance.toFixed(2)} €</span>
                  </div>
                </div>
                <div style={{...styles.statCard, ...styles.statCardIncome}}>
                  <div style={styles.statIcon}>📈</div>
                  <div style={styles.statContent}>
                    <span style={styles.statLabel}>Total recettes</span>
                    <span style={styles.statValue}>{totalIncome.toFixed(2)} €</span>
                  </div>
                </div>
                <div style={{...styles.statCard, ...styles.statCardExpense}}>
                  <div style={styles.statIcon}>📉</div>
                  <div style={styles.statContent}>
                    <span style={styles.statLabel}>Total dépenses</span>
                    <span style={styles.statValue}>{totalExpense.toFixed(2)} €</span>
                  </div>
                </div>
                <div style={{...styles.statCard, ...styles.statCardProjects}}>
                  <div style={styles.statIcon}>🚀</div>
                  <div style={styles.statContent}>
                    <span style={styles.statLabel}>Projets en cours</span>
                    <span style={styles.statValue}>{projectsInProgress}</span>
                  </div>
                </div>
              </div>

              <div style={styles.dashboardGrid}>
                <div style={styles.dashboardCard}>
                  <h3 style={styles.cardTitle}>Dernières transactions</h3>
                  <div style={styles.miniList}>
                    {transactions.slice(-5).reverse().map(t => (
                      <div key={t.id} style={styles.miniListItem}>
                        <span style={{...styles.transactionBadge, backgroundColor: t.type === 'income' ? '#10b981' : '#ef4444'}}>
                          {t.type === 'income' ? '+' : '-'}
                        </span>
                        <span style={styles.miniListText}>{t.description}</span>
                        <span style={{...styles.miniListAmount, color: t.type === 'income' ? '#10b981' : '#ef4444'}}>
                          {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)} €
                        </span>
                      </div>
                    ))}
                    {transactions.length === 0 && <p style={styles.emptyText}>Aucune transaction</p>}
                  </div>
                </div>

                <div style={styles.dashboardCard}>
                  <h3 style={styles.cardTitle}>Projets en cours</h3>
                  <div style={styles.miniList}>
                    {projects.filter(p => p.status !== 'completed' && p.status !== 'abandoned').map(p => (
                      <div key={p.id} style={styles.miniListItem}>
                        <span style={{...styles.statusDot, backgroundColor: statusColors[p.status]}}></span>
                        <span style={styles.miniListText}>{p.title}</span>
                        <span style={styles.miniListMeta}>{statusLabels[p.status]}</span>
                      </div>
                    ))}
                    {projects.filter(p => p.status !== 'completed' && p.status !== 'abandoned').length === 0 && 
                      <p style={styles.emptyText}>Aucun projet en cours</p>}
                  </div>
                </div>

                <div style={styles.dashboardCard}>
                  <h3 style={styles.cardTitle}>Dernières idées</h3>
                  <div style={styles.miniList}>
                    {ideas.slice(-3).reverse().map(i => (
                      <div key={i.id} style={styles.miniListItem}>
                        <span style={styles.ideaIcon}>💡</span>
                        <span style={styles.miniListText}>{i.title}</span>
                        <span style={styles.votesBadge}>{i.votes || 0} ❤️</span>
                      </div>
                    ))}
                    {ideas.length === 0 && <p style={styles.emptyText}>Aucune idée</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Finances */}
          {activeTab === 'finances' && (
            <div>
              <div style={styles.pageHeader}>
                <h1 style={styles.pageTitle}>Gestion des finances</h1>
                {isAdmin && (
                  <button onClick={() => { setEditingItem(null); setShowTransactionModal(true); }} style={styles.addButton}>
                    + Nouvelle transaction
                  </button>
                )}
              </div>

              <div style={styles.financesSummary}>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Recettes</span>
                  <span style={{...styles.summaryValue, color: '#10b981'}}>{totalIncome.toFixed(2)} €</span>
                </div>
                <div style={styles.summaryDivider}>-</div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Dépenses</span>
                  <span style={{...styles.summaryValue, color: '#ef4444'}}>{totalExpense.toFixed(2)} €</span>
                </div>
                <div style={styles.summaryDivider}>=</div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Solde</span>
                  <span style={{...styles.summaryValue, color: balance >= 0 ? '#10b981' : '#ef4444'}}>{balance.toFixed(2)} €</span>
                </div>
              </div>

              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Catégorie</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Montant</th>
                      {isAdmin && <th style={styles.th}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
                      <tr key={t.id} style={styles.tr}>
                        <td style={styles.td}>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td style={styles.td}>
                          <span style={{...styles.typeBadge, backgroundColor: t.type === 'income' ? '#dcfce7' : '#fee2e2', color: t.type === 'income' ? '#166534' : '#991b1b'}}>
                            {t.type === 'income' ? 'Recette' : 'Dépense'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{...styles.categoryBadge, backgroundColor: categoryColors[t.category] || categoryColors['Autre']}}>
                            {t.category}
                          </span>
                        </td>
                        <td style={styles.td}>{t.description}</td>
                        <td style={{...styles.td, ...styles.amountCell, color: t.type === 'income' ? '#10b981' : '#ef4444'}}>
                          {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)} €
                        </td>
                        {isAdmin && (
                          <td style={styles.td}>
                            <button onClick={() => { setEditingItem(t); setShowTransactionModal(true); }} style={styles.editBtn}>✏️</button>
                            <button onClick={() => deleteTransaction(t.id)} style={styles.deleteBtn}>🗑️</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transactions.length === 0 && <p style={styles.emptyTableText}>Aucune transaction enregistrée</p>}
              </div>
            </div>
          )}

          {/* Projects */}
          {activeTab === 'projects' && (
            <div>
              <div style={styles.pageHeader}>
                <h1 style={styles.pageTitle}>Suivi des projets</h1>
                {isAdmin && (
                  <button onClick={() => { setEditingItem(null); setShowProjectModal(true); }} style={styles.addButton}>
                    + Nouveau projet
                  </button>
                )}
              </div>

              <div style={styles.projectsGrid}>
                {projects.map(p => (
                  <div key={p.id} style={styles.projectCard}>
                    <div style={styles.projectHeader}>
                      <span style={{...styles.projectStatus, backgroundColor: statusColors[p.status]}}>
                        {statusLabels[p.status]}
                      </span>
                      {isAdmin && (
                        <div>
                          <button onClick={() => { setEditingItem(p); setShowProjectModal(true); }} style={styles.editBtn}>✏️</button>
                          <button onClick={() => deleteProject(p.id)} style={styles.deleteBtn}>🗑️</button>
                        </div>
                      )}
                    </div>
                    <h3 style={styles.projectTitle}>{p.title}</h3>
                    <p style={styles.projectDesc}>{p.description}</p>
                    <div style={styles.projectMeta}>
                      <span>👤 {p.responsible}</span>
                      {p.deadline && <span>📅 {new Date(p.deadline).toLocaleDateString('fr-FR')}</span>}
                    </div>
                    {p.notes && <p style={styles.projectNotes}>📝 {p.notes}</p>}
                  </div>
                ))}
              </div>
              {projects.length === 0 && <p style={styles.emptyText}>Aucun projet enregistré</p>}
            </div>
          )}

          {/* Ideas */}
          {activeTab === 'ideas' && (
            <div>
              <div style={styles.pageHeader}>
                <h1 style={styles.pageTitle}>Boîte à idées</h1>
                <button onClick={() => { setEditingItem(null); setShowIdeaModal(true); }} style={styles.addButton}>
                  + Proposer une idée
                </button>
              </div>

              <div style={styles.ideasGrid}>
                {ideas.sort((a, b) => (b.votes || 0) - (a.votes || 0)).map(i => (
                  <div key={i.id} style={styles.ideaCard}>
                    <div style={styles.ideaHeader}>
                      <span style={styles.ideaAuthor}>💡 {i.author}</span>
                      {isAdmin && (
                        <div>
                          <button onClick={() => { setEditingItem(i); setShowIdeaModal(true); }} style={styles.editBtn}>✏️</button>
                          <button onClick={() => deleteIdea(i.id)} style={styles.deleteBtn}>🗑️</button>
                        </div>
                      )}
                    </div>
                    <h3 style={styles.ideaTitle}>{i.title}</h3>
                    <p style={styles.ideaDesc}>{i.description}</p>
                    <div style={styles.ideaFooter}>
                      <span style={styles.ideaDate}>{new Date(i.date).toLocaleDateString('fr-FR')}</span>
                      <button onClick={() => voteIdea(i.id)} style={styles.voteButton}>
                        ❤️ {i.votes || 0}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {ideas.length === 0 && <p style={styles.emptyText}>Aucune idée proposée</p>}
            </div>
          )}

          {/* Users */}
          {activeTab === 'users' && isAdmin && (
            <div>
              <div style={styles.pageHeader}>
                <h1 style={styles.pageTitle}>Gestion des utilisateurs</h1>
                <button onClick={() => { setEditingItem(null); setShowUserModal(true); }} style={styles.addButton}>
                  + Nouvel utilisateur
                </button>
              </div>

              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nom</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Rôle</th>
                      <th style={styles.th}>Date de création</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={styles.tr}>
                        <td style={styles.td}>{u.name}</td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>
                          <span style={{...styles.roleBadge, backgroundColor: u.role === 'admin' ? '#7c3238' : '#64748b'}}>
                            {u.role === 'admin' ? 'Administrateur' : 'Lecteur'}
                          </span>
                        </td>
                        <td style={styles.td}>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td style={styles.td}>
                          <button onClick={() => { setEditingItem(u); setShowUserModal(true); }} style={styles.editBtn}>✏️</button>
                          <button onClick={() => deleteUser(u.id)} style={styles.deleteBtn} disabled={u.id === currentUser.id}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modales */}
      {showUserModal && (
        <Modal title={editingItem ? 'Modifier utilisateur' : 'Nouvel utilisateur'} onClose={() => { setShowUserModal(false); setEditingItem(null); }}>
          <UserForm initialData={editingItem} onSave={saveUser} onCancel={() => { setShowUserModal(false); setEditingItem(null); }} />
        </Modal>
      )}

      {showTransactionModal && (
        <Modal title={editingItem ? 'Modifier transaction' : 'Nouvelle transaction'} onClose={() => { setShowTransactionModal(false); setEditingItem(null); }}>
          <TransactionForm initialData={editingItem} onSave={saveTransaction} onCancel={() => { setShowTransactionModal(false); setEditingItem(null); }} />
        </Modal>
      )}

      {showProjectModal && (
        <Modal title={editingItem ? 'Modifier projet' : 'Nouveau projet'} onClose={() => { setShowProjectModal(false); setEditingItem(null); }}>
          <ProjectForm initialData={editingItem} onSave={saveProject} onCancel={() => { setShowProjectModal(false); setEditingItem(null); }} />
        </Modal>
      )}

      {showIdeaModal && (
        <Modal title={editingItem ? 'Modifier idée' : 'Proposer une idée'} onClose={() => { setShowIdeaModal(false); setEditingItem(null); }}>
          <IdeaForm initialData={editingItem} onSave={saveIdea} onCancel={() => { setShowIdeaModal(false); setEditingItem(null); }} />
        </Modal>
      )}
    </div>
  );
}

// Composant Modal
function Modal({ title, children, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button onClick={onClose} style={styles.modalClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Formulaires
function UserForm({ initialData, onSave, onCancel }) {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState(initialData?.password || '');
  const [role, setRole] = useState(initialData?.role || 'reader');

  const handleSubmit = () => {
    if (name && email && password) {
      onSave({ name, email, password, role });
    }
  };

  return (
    <div style={styles.form}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Nom complet</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Mot de passe</label>
        <input type="text" value={password} onChange={e => setPassword(e.target.value)} style={styles.input} placeholder="Définir un mot de passe" />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Rôle</label>
        <select value={role} onChange={e => setRole(e.target.value)} style={styles.select}>
          <option value="admin">Administrateur (Bureau)</option>
          <option value="reader">Lecteur (CA)</option>
        </select>
      </div>
      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>Annuler</button>
        <button type="button" onClick={handleSubmit} style={styles.submitButton}>Enregistrer</button>
      </div>
    </div>
  );
}

function TransactionForm({ initialData, onSave, onCancel }) {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [type, setType] = useState(initialData?.type || 'expense');
  const [category, setCategory] = useState(initialData?.category || 'Autre');
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount || '');

  const handleSubmit = () => {
    if (description && amount) {
      onSave({ date, type, category, description, amount: parseFloat(amount) });
    }
  };

  return (
    <div style={styles.form}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Type</label>
        <select value={type} onChange={e => setType(e.target.value)} style={styles.select}>
          <option value="income">Recette</option>
          <option value="expense">Dépense</option>
        </select>
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Catégorie</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={styles.select}>
          <option value="Cotisations">Cotisations</option>
          <option value="Dons">Dons</option>
          <option value="Partenariats">Partenariats</option>
          <option value="Serveurs">Serveurs</option>
          <option value="Outils">Outils</option>
          <option value="Événements">Événements</option>
          <option value="Autre">Autre</option>
        </select>
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Description</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Montant (€)</label>
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>Annuler</button>
        <button type="button" onClick={handleSubmit} style={styles.submitButton}>Enregistrer</button>
      </div>
    </div>
  );
}

function ProjectForm({ initialData, onSave, onCancel }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [status, setStatus] = useState(initialData?.status || 'planning');
  const [responsible, setResponsible] = useState(initialData?.responsible || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [deadline, setDeadline] = useState(initialData?.deadline || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = () => {
    if (title && responsible && description) {
      onSave({ title, status, responsible, description, deadline, notes });
    }
  };

  return (
    <div style={styles.form}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Titre du projet</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Statut</label>
        <select value={status} onChange={e => setStatus(e.target.value)} style={styles.select}>
          <option value="planning">En réflexion</option>
          <option value="in_progress">En cours</option>
          <option value="completed">Terminé</option>
          <option value="abandoned">Abandonné</option>
        </select>
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Responsable</label>
        <input type="text" value={responsible} onChange={e => setResponsible(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} style={styles.textarea} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Échéance</label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Notes de suivi</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={styles.textarea} />
      </div>
      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>Annuler</button>
        <button type="button" onClick={handleSubmit} style={styles.submitButton}>Enregistrer</button>
      </div>
    </div>
  );
}

function IdeaForm({ initialData, onSave, onCancel }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');

  const handleSubmit = () => {
    if (title && description) {
      onSave({ title, description });
    }
  };

  return (
    <div style={styles.form}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Titre de l'idée</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={styles.input} />
      </div>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} style={styles.textarea} placeholder="Décrivez votre idée en détail..." />
      </div>
      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>Annuler</button>
        <button type="button" onClick={handleSubmit} style={styles.submitButton}>Proposer</button>
      </div>
    </div>
  );
}

// Styles
const styles = {
  // Loading
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  loadingCard: {
    textAlign: 'center',
    color: 'white',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid #7c3238',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '18px',
    opacity: 0.8,
  },

  // Login
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  loginCard: {
    background: 'rgba(255,255,255,0.98)',
    borderRadius: '20px',
    padding: '48px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
  },
  loginLogo: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#7c3238',
    letterSpacing: '2px',
  },
  logoC: {
    fontSize: '36px',
    fontWeight: '900',
  },
  logoSimulation: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#7c3238',
    letterSpacing: '8px',
    marginTop: '4px',
  },
  loginTitle: {
    textAlign: 'center',
    color: '#374151',
    fontSize: '18px',
    fontWeight: '500',
    marginBottom: '32px',
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#4b5563',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '2px solid #e5e7eb',
    fontSize: '15px',
    transition: 'all 0.2s',
    outline: 'none',
  },
  loginButton: {
    marginTop: '12px',
    padding: '16px',
    background: 'linear-gradient(135deg, #7c3238 0%, #9a3c44 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  error: {
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center',
    margin: 0,
  },
  hint: {
    marginTop: '24px',
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'center',
  },

  // App Layout
  app: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    background: 'linear-gradient(135deg, #7c3238 0%, #5c2428 100%)',
    color: 'white',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 20px rgba(124, 50, 56, 0.3)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerLogo: {
    fontSize: '20px',
    fontWeight: '800',
    letterSpacing: '1px',
  },
  headerLogoC: {
    fontSize: '26px',
  },
  headerLogoSim: {
    fontWeight: '600',
    opacity: '0.9',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  userName: {
    fontWeight: '600',
    fontSize: '15px',
  },
  userRole: {
    fontSize: '12px',
    opacity: '0.8',
  },
  logoutButton: {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  container: {
    display: 'flex',
    minHeight: 'calc(100vh - 72px)',
  },
  sidebar: {
    width: '260px',
    background: 'white',
    borderRight: '1px solid #e5e7eb',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    color: '#4b5563',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  navButtonActive: {
    background: 'linear-gradient(135deg, #7c3238 0%, #9a3c44 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(124, 50, 56, 0.3)',
  },
  navIcon: {
    fontSize: '18px',
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },

  // Dashboard
  dashboard: {},
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '28px',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '32px',
  },
  statCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    border: '1px solid #f1f5f9',
  },
  statCardBalance: { borderLeft: '4px solid #7c3238' },
  statCardIncome: { borderLeft: '4px solid #10b981' },
  statCardExpense: { borderLeft: '4px solid #ef4444' },
  statCardProjects: { borderLeft: '4px solid #3b82f6' },
  statIcon: {
    fontSize: '32px',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
  dashboardCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    border: '1px solid #f1f5f9',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #f1f5f9',
  },
  miniList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  miniListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: '#f8fafc',
    borderRadius: '8px',
  },
  miniListText: {
    flex: 1,
    fontSize: '14px',
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniListAmount: {
    fontWeight: '600',
    fontSize: '14px',
  },
  miniListMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  transactionBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '700',
    fontSize: '14px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  ideaIcon: {
    fontSize: '18px',
  },
  votesBadge: {
    fontSize: '12px',
    color: '#6b7280',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
    padding: '20px',
  },
  emptyTableText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
    padding: '40px',
  },

  // Tables
  tableContainer: {
    background: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    border: '1px solid #f1f5f9',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '16px 20px',
    background: '#f8fafc',
    fontWeight: '600',
    fontSize: '13px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e5e7eb',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.2s',
  },
  td: {
    padding: '16px 20px',
    fontSize: '14px',
    color: '#374151',
  },
  amountCell: {
    fontWeight: '600',
    fontFamily: 'monospace',
    fontSize: '15px',
  },
  typeBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
  },
  categoryBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'white',
  },
  roleBadge: {
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
  },
  editBtn: {
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    opacity: '0.7',
    transition: 'opacity 0.2s',
  },
  deleteBtn: {
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    opacity: '0.7',
    transition: 'opacity 0.2s',
  },
  addButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #7c3238 0%, #9a3c44 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(124, 50, 56, 0.3)',
    transition: 'transform 0.2s',
  },

  // Finances
  financesSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '32px',
    padding: '28px',
    background: 'white',
    borderRadius: '16px',
    marginBottom: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: '28px',
    fontWeight: '700',
  },
  summaryDivider: {
    fontSize: '24px',
    color: '#d1d5db',
    fontWeight: '300',
  },

  // Projects
  projectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '24px',
  },
  projectCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    border: '1px solid #f1f5f9',
  },
  projectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  projectStatus: {
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
  },
  projectTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
  },
  projectDesc: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  projectMeta: {
    display: 'flex',
    gap: '20px',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '12px',
  },
  projectNotes: {
    fontSize: '13px',
    color: '#7c3238',
    background: '#fef2f2',
    padding: '12px',
    borderRadius: '8px',
    fontStyle: 'italic',
  },

  // Ideas
  ideasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  ideaCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    border: '1px solid #f1f5f9',
  },
  ideaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  ideaAuthor: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: '500',
  },
  ideaTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
  },
  ideaDesc: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  ideaFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9',
  },
  ideaDate: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  voteButton: {
    padding: '8px 16px',
    background: '#fef2f2',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#7c3238',
    transition: 'all 0.2s',
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f1f5f9',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
  },
  modalClose: {
    width: '36px',
    height: '36px',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '24px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  select: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '2px solid #e5e7eb',
    fontSize: '15px',
    outline: 'none',
    background: 'white',
  },
  textarea: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '2px solid #e5e7eb',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '12px',
  },
  cancelButton: {
    padding: '12px 24px',
    background: '#f1f5f9',
    color: '#4b5563',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #7c3238 0%, #9a3c44 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
