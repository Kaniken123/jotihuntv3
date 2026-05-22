import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Tenant } from '../types';

interface TenantSwitcherProps {
  className?: string;
}

const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ className = '' }) => {
  const { state, switchTenant } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  if (!state.isSuperAdmin || !state.availableTenants?.length) {
    return null;
  }

  const handleTenantSwitch = async (tenantId: number) => {
    if (tenantId === state.currentTenant?.id) return;
    
    setIsLoading(true);
    try {
      await switchTenant(tenantId);
      window.location.reload(); // Reload to refresh all tenant-aware data
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`tenant-switcher ${className}`}>
      <label className="text-sm font-medium text-gray-700">
        {t('tenant.current')}
      </label>
      <select
        value={state.currentTenant?.id || ''}
        onChange={(e) => handleTenantSwitch(Number(e.target.value))}
        disabled={isLoading}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
      >
        {state.availableTenants.map((tenant: Tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
      {isLoading && (
        <div className="text-xs text-gray-500 mt-1">
          {t('tenant.switching')}
        </div>
      )}
    </div>
  );
};

export default TenantSwitcher;