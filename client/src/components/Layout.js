import React, { useState } from 'react';
import Footer from './Footer';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          { path: '/admin/profile', label: 'Профиль' },
        ];
      case 'specialist':
        return [
          { path: '/specialist', label: 'Клиенты и тикеты' },
        ];
      case 'client':
        return [
          { path: '/client', label: 'Панель' },
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
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-primary-600">
                  Обсидиан
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      location.pathname.startsWith(item.path)
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-gray-700">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium px-2 py-1 rounded hover:bg-gray-100"
              >
                Выйти
              </button>
              {/* Мобильное меню кнопка */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Мобильное меню */}
          {mobileMenuOpen && (
            <div className="sm:hidden pb-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 text-sm font-medium rounded-md ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="px-4 py-2 text-sm text-gray-700 sm:hidden">
                {user.name}
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-grow w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;