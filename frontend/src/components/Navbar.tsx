import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, MessageSquare, Camera, FileText, Book, Shield, Route, Menu, X } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

const Navbar: React.FC = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { state, logout } = useAuth();
  const { user, team } = state;
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navigation = [
    { name: 'Map', href: '/', icon: Map, current: location.pathname === '/' },
    { name: 'Chat', href: '/chat', icon: MessageSquare, current: location.pathname === '/chat' },
    { name: 'Hunt', href: '/hunt', icon: Camera, current: location.pathname === '/hunt' },
    { name: 'Updates', href: '/updates', icon: FileText, current: location.pathname === '/updates' },
    { name: 'Regels', href: '/rules', icon: Book, current: location.pathname === '/rules' },
    ...(user?.role === 'admin' ? [
      { name: 'Admin', href: '/admin', icon: Shield, current: location.pathname === '/admin' }
    ] : []),
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400">
                Jotihunt V2
              </Link>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center space-x-2 px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                      item.current
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
            
            {team && (
              <div className="ml-6 flex items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Team: <span className="font-medium text-gray-900 dark:text-gray-100">{team.name}</span>
                </span>
                {team.area && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                    {team.area}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Notification Center */}
            <div className="hidden sm:block">
              <NotificationCenter />
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.first_name && user?.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user?.username}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.role === 'admin' ? 'Administrator' : 'Hunter'}
                    </div>
                  </div>
                  <svg
                    className={`ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 ${
                      isProfileOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isProfileOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user?.username}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user?.email}
                      </p>
                    </div>
                    
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Location Settings
                    </Link>
                    
                    {user?.role === 'admin' && (
                      <>
                        <Link
                          to="/admin"
                          onClick={() => setIsProfileOpen(false)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Admin Panel
                        </Link>
                        <Link
                          to="/admin/routes"
                          onClick={() => setIsProfileOpen(false)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                        >
                          <Route className="w-4 h-4" />
                          <span>Route Tracking</span>
                        </Link>
                      </>
                    )}
                    
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={closeMobileMenu}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                      item.current
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* User info and actions in mobile */}
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.first_name && user?.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user?.username}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {user?.role === 'admin' ? 'Administrator' : 'Hunter'}
                    </p>
                  </div>
                </div>

                {/* Mobile notification center */}
                <div className="mb-3 sm:hidden">
                  <div className="flex items-center space-x-3 px-3 py-2">
                    <NotificationCenter />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications</span>
                  </div>
                </div>

                {/* Mobile action buttons */}
                <div className="space-y-1">
                  <Link
                    to="/settings"
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    <span>Location Settings</span>
                  </Link>
                  
                  {user?.role === 'admin' && (
                    <>
                      <Link
                        to="/admin"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin Panel</span>
                      </Link>
                      <Link
                        to="/admin/routes"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      >
                        <Route className="w-4 h-4" />
                        <span>Route Tracking</span>
                      </Link>
                    </>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-left"
                  >
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;