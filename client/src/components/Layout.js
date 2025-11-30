import React, { useState, useRef, useEffect } from 'react';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef();
  const searchTimerRef = useRef();
  const profileRef = useRef();
  const notificationsRef = useRef();
  const mobileNotificationsRef = useRef();

  const formatServerDateToLocal = (dateStr) => {
    if (!dateStr) return '';
    try {
      // If server already returned ISO with timezone, Date will handle it correctly
      if (dateStr.includes('T')) {
        return new Date(dateStr).toLocaleString();
      }
      // If server returned 'YYYY-MM-DD HH:MM:SS' (SQLite CURRENT_TIMESTAMP),
      // interpret it as UTC and convert to local time by appending 'Z'
      const asIso = dateStr.replace(' ', 'T') + 'Z';
      return new Date(asIso).toLocaleString();
    } catch (e) {
      return new Date(dateStr).toLocaleString();
    }
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // Fetch notifications and poll periodically
  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (!mounted) return;
        setNotifications(res.data || []);
        setUnreadCount((res.data || []).filter(n => n.read === 0).length);
      } catch (e) {
        // ignore
      }
    };

    if (user) fetchNotifications();
    const iv = setInterval(fetchNotifications, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, [user]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const onDoc = (e) => {
      const notifsEl = notificationsRef.current;
      const mobileNotifsEl = mobileNotificationsRef.current;
      const clickedInsideDesktop = notifsEl && notifsEl.contains(e.target);
      const clickedInsideMobile = mobileNotifsEl && mobileNotifsEl.contains(e.target);
      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const onDoc = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'admin':
        return [
          { path: '/admin/clients', label: 'Клиенты' },
          { path: '/admin/services', label: 'Услуги' },
          { path: '/admin/tickets', label: 'Тикеты' },
        ];
      case 'specialist':
        return [{ path: '/specialist', label: 'Тикеты' }];
      case 'client':
        return [
          { path: '/client', label: 'Панель' },
          { path: '/client/tickets/all', label: 'Мои заявки' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  if (!user) {
    return children;
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden md:flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <div className="hidden sm:flex w-9 h-9 bg-primary-600 rounded-lg items-center justify-center text-white font-bold">O</div>
                <div className="block">
                  <div className="text-lg font-semibold text-gray-900">Обсидиан</div>
                </div>
              </Link>

              <nav className="hidden md:flex md:items-center md:space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname.startsWith(item.path)
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:block w-64">
                <label className="relative block">
                  <span className="sr-only">Search</span>
                  <div className="relative" ref={searchRef}>
                    <input
                      value={query}
                      onChange={(e) => {
                        const v = e.target.value;
                        setQuery(v);
                        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                        if (!v || v.length < 2) {
                          setSearchResults([]);
                          setSearchOpen(false);
                          return;
                        }
                        searchTimerRef.current = setTimeout(async () => {
                          setSearchLoading(true);
                          try {
                            const res = await api.get('/tickets/search?q=' + encodeURIComponent(v));
                            setSearchResults(res.data || []);
                            setSearchOpen(true);
                          } catch (err) {
                            setSearchResults([]);
                          } finally {
                            setSearchLoading(false);
                          }
                        }, 300);
                      }}
                      placeholder="Поиск по тикетам..."
                      className="placeholder-gray-400 block w-full bg-gray-50 border border-gray-200 rounded-md py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {searchLoading ? (
                        <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 12.65z" />
                        </svg>
                      )}
                    </span>

                    {searchOpen && searchResults.length > 0 && (
                      <div className="absolute left-0 mt-1 w-full bg-white rounded-md shadow-lg z-40 max-h-60 overflow-auto">
                        {searchResults.map((s) => (
                          <div key={s.id} onClick={() => {
                            setSearchOpen(false);
                            setQuery('');
                            if (user && user.role === 'client') {
                              navigate(`/client/tickets/${s.id}`);
                            } else {
                              navigate(`/admin/tickets/${s.id}`);
                            }
                          }} className="px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <div className="text-sm font-medium text-gray-800">{s.title}</div>
                            <div className="text-xs text-gray-500">{(user && user.role !== 'client' && s.client_name) ? `${s.client_name} • ${s.status}` : s.status} • {formatServerDateToLocal(s.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 12.65z" />
                    </svg>
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative" ref={notificationsRef}>
                  <button
                    title="Оповещения"
                    onClick={async () => {
                      setNotificationsOpen(!notificationsOpen);
                      // refresh on open
                      if (!notificationsOpen) {
                        try {
                          const res = await api.get('/notifications');
                          setNotifications(res.data || []);
                          setUnreadCount((res.data || []).filter(n => n.read === 0).length);
                        } catch (e) {}
                      }
                    }}
                    className="p-2 rounded-md text-gray-600 hover:bg-gray-100 relative"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">{unreadCount}</span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-30">
                      <div className="py-2">
                        <div className="px-3 pb-2 flex items-center justify-between">
                          <strong>Оповещения</strong>
                          <button className="text-xs text-gray-500" onClick={async () => {
                            try { await api.put('/notifications/read-all'); setNotifications([]); setUnreadCount(0); } catch (e) {}
                          }}>Отметить все</button>
                        </div>
                        {notifications.length === 0 && (
                          <div className="px-4 py-6 text-center text-sm text-gray-500">Нет новых уведомлений</div>
                        )}
                        {notifications.map((n) => (
                          <div key={n.id} onClick={async () => {
                            try {
                              await api.put(`/notifications/${n.id}/read`);
                            } catch (e) {}
                            // навигация по типу (role-aware)
                            if (n.reference_type === 'ticket' && n.reference_id) {
                              if (user && user.role === 'client') {
                                navigate(`/client/tickets/${n.reference_id}`);
                              } else {
                                navigate(`/admin/tickets/${n.reference_id}`);
                              }
                            } else if (n.reference_type === 'invoice' && n.reference_id) {
                              navigate(`/client/invoices`);
                            } else if (n.reference_type === 'recommendation' && n.reference_id) {
                              navigate(`/client`);
                            } else {
                              // fallback
                              navigate(`/${user.role}`);
                            }
                            // визуально пометить локально
                            setNotifications((prev) => prev.map(p => p.id === n.id ? { ...p, read: 1 } : p));
                            setUnreadCount((prev) => Math.max(0, prev - (n.read === 0 ? 1 : 0)));
                            setNotificationsOpen(false);
                          }} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${n.read ? 'opacity-80' : 'bg-white'}`}>
                            <div className="flex justify-between">
                              <div className="text-sm text-gray-800">{n.title || n.type}</div>
                              <div className="text-xs text-gray-400">{formatServerDateToLocal(n.created_at)}</div>
                            </div>
                            {n.message && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{n.message}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={profileRef}>
                  <div className="flex items-center">
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100"
                      aria-haspopup="true"
                      aria-expanded={profileOpen}
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm text-gray-700">{(user.name || 'U').charAt(0)}</div>
                      <div className="hidden md:flex md:flex-col md:items-start">
                        <span className="text-sm text-gray-700">{user.name}</span>
                        <span className="text-xs text-gray-400">{user.role}</span>
                      </div>
                    </button>
                  </div>

                  {profileOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                      <div className="py-1">
                        <Link to={`/${user.role}/profile`} onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Профиль</Link>
                        {user.role === 'admin' && (
                          <Link to="/admin/clients/new" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Новый клиент</Link>
                        )}
                        {user.role === 'client' && (
                          <Link to="/client/tickets/new" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Создать заявку</Link>
                        )}
                        <button onClick={() => { setProfileOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Выйти</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile navigation - compact single-line header with burger+username on right */}
          <div className="flex md:hidden items-center justify-between h-12 w-full">
            <div className="text-lg font-semibold text-gray-900">Обсидиан</div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={mobileNotificationsRef}>
                <button
                  title="Оповещения"
                  onClick={async () => {
                    setNotificationsOpen(!notificationsOpen);
                    if (!notificationsOpen) {
                      try {
                        const res = await api.get('/notifications');
                        setNotifications(res.data || []);
                        setUnreadCount((res.data || []).filter(n => n.read === 0).length);
                      } catch (e) {}
                    }
                  }}
                  className="p-2 rounded-md text-gray-600 hover:bg-gray-100 relative"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">{unreadCount}</span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="origin-top-right absolute right-4 top-12 mt-2 w-80 max-h-96 overflow-auto rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-40">
                    <div className="py-2">
                      <div className="px-3 pb-2 flex items-center justify-between">
                        <strong>Оповещения</strong>
                        <button className="text-xs text-gray-500" onClick={async () => {
                          try { await api.put('/notifications/read-all'); setNotifications([]); setUnreadCount(0); } catch (e) {}
                        }}>Отметить все</button>
                      </div>
                      {notifications.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">Нет новых уведомлений</div>
                      )}
                      {notifications.map((n) => (
                        <div key={n.id} onClick={async () => {
                          try {
                            await api.put(`/notifications/${n.id}/read`);
                          } catch (e) {}
                          // навигация по типу (role-aware)
                          if (n.reference_type === 'ticket' && n.reference_id) {
                            if (user && user.role === 'client') {
                              navigate(`/client/tickets/${n.reference_id}`);
                            } else {
                              navigate(`/admin/tickets/${n.reference_id}`);
                            }
                          } else if (n.reference_type === 'invoice' && n.reference_id) {
                            navigate(`/client/invoices`);
                          } else if (n.reference_type === 'recommendation' && n.reference_id) {
                            navigate(`/client`);
                          } else {
                            // fallback
                            navigate(`/${user.role}`);
                          }
                          // визуально пометить локально
                          setNotifications((prev) => prev.map(p => p.id === n.id ? { ...p, read: 1 } : p));
                          setUnreadCount((prev) => Math.max(0, prev - (n.read === 0 ? 1 : 0)));
                          setNotificationsOpen(false);
                        }} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${n.read ? 'opacity-80' : 'bg-white'}`}>
                          <div className="flex justify-between">
                            <div className="text-sm text-gray-800">{n.title || n.type}</div>
                            <div className="text-xs text-gray-400">{formatServerDateToLocal(n.created_at)}</div>
                          </div>
                          {n.message && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{n.message}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100">
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="absolute left-2 right-2 top-12 bg-white rounded-md shadow-lg p-3 z-40">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-sm ${location.pathname.startsWith(item.path) ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t mt-3 pt-3">
                <Link to={`/${user.role}/profile`} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-gray-700">Профиль</Link>
                <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="w-full text-left px-3 py-2 text-sm text-gray-700">Выйти</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
};

export default Layout;