import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, authService } from '../services/authService';
import LoadingSpinner from './LoadingSpinner';

const Login: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Tenant selection modal state
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<Array<{id: number, name: string, slug: string, user_id: number}>>([]);
  const [pendingUsername, setPendingUsername] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (isLoginMode) {
        const result = await login(username, password);
        
        if (result.requires_tenant_selection) {
          // User has multiple tenants, show selection modal
          setTenantOptions(result.tenant_options || []);
          setPendingUsername(username);
          setPendingPassword(password);
          setShowTenantModal(true);
          setIsLoading(false);
          return;
        }
        // Login successful, user will be redirected by auth state change
      } else {
        // Registration
        await authService.register({
          username,
          email,
          password,
          first_name: firstName,
          last_name: lastName
        });
        setSuccess('Registration successful! You can now log in.');
        setIsLoginMode(true);
        // Clear form
        setUsername('');
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isLoginMode ? 'Login failed' : 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantSelection = async (tenantId: number) => {
    setIsLoading(true);
    try {
      await login(pendingUsername, pendingPassword, tenantId);
      // Login successful, modal will close and user will be redirected
      setShowTenantModal(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      setShowTenantModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {isLoginMode ? 'Sign in to Jotihunt' : 'Create your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {isLoginMode ? 'Enter your credentials to access the game' : 'Join the hunt by creating a new account'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="card p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-lg text-sm">
                {success}
              </div>
            )}
            
            <div className="space-y-4">
              {!isLoginMode && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        First Name
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        className="input"
                        placeholder="Your first name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        className="input"
                        placeholder="Your last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="input"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}
              
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="input"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="input"
                  placeholder={isLoginMode ? "Enter your password" : "Choose a secure password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  minLength={!isLoginMode ? 6 : undefined}
                />
                {!isLoginMode && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>
            </div>
            
            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    {isLoginMode ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  isLoginMode ? 'Sign in' : 'Create account'
                )}
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError('');
                  setSuccess('');
                }}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {isLoginMode ? "Don't have an account? Create one" : "Already have an account? Sign in"}
              </button>
            </div>
            
          </div>
        </form>
      </div>

      {/* Tenant Selection Modal */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Select Organization
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              You have access to multiple organizations. Please select which one you'd like to access:
            </p>
            
            <div className="space-y-3">
              {tenantOptions.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSelection(tenant.id)}
                  disabled={isLoading}
                  className="w-full p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {tenant.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {tenant.slug}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowTenantModal(false);
                  setPendingUsername('');
                  setPendingPassword('');
                  setTenantOptions([]);
                }}
                disabled={isLoading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>

            {isLoading && (
              <div className="mt-4 flex items-center justify-center">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-gray-500">Signing in...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;