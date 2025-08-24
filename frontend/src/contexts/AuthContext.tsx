import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User, Team, Tenant } from '../types/index';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  team: Team | null;
  token: string | null;
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; team?: Team; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SWITCH_TENANT'; payload: { tenant: Tenant; token: string } };

const initialState: AuthState = {
  user: null,
  team: null,
  token: localStorage.getItem('token'),
  currentTenant: null,
  availableTenants: [],
  isLoading: true,
  isAuthenticated: false,
  isSuperAdmin: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        team: action.payload.team || null,
        token: action.payload.token,
        currentTenant: action.payload.user?.current_tenant || action.payload.user?.tenant || null,
        availableTenants: action.payload.user?.available_tenants || [],
        isLoading: false,
        isAuthenticated: true,
        isSuperAdmin: action.payload.user?.is_super_admin || false,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        team: null,
        token: null,
        currentTenant: null,
        availableTenants: [],
        isLoading: false,
        isAuthenticated: false,
        isSuperAdmin: false,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        team: null,
        token: null,
        currentTenant: null,
        availableTenants: [],
        isLoading: false,
        isAuthenticated: false,
        isSuperAdmin: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
        currentTenant: action.payload?.current_tenant || action.payload?.tenant || state.currentTenant,
        availableTenants: action.payload?.available_tenants || state.availableTenants,
        isSuperAdmin: action.payload?.is_super_admin || false,
      };
    case 'SWITCH_TENANT':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        currentTenant: action.payload.tenant,
        token: action.payload.token,
      };
    default:
      return state;
  }
};

interface AuthContextType {
  state: AuthState;
  login: (username: string, password: string, selected_tenant_id?: number) => Promise<{
    requires_tenant_selection?: boolean;
    tenant_options?: Array<{id: number, name: string, slug: string, user_id: number}>;
  }>;
  logout: () => void;
  updateUser: (user: User) => void;
  switchTenant: (tenantId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authService.getCurrentUser();
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: response.user,
              team: response.team,
              token,
            },
          });
        } catch (error) {
          dispatch({ type: 'AUTH_FAILURE' });
          localStorage.removeItem('token');
        }
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string, selected_tenant_id?: number) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const response = await authService.login(username, password, selected_tenant_id);
      
      // If tenant selection is required, return that info without setting auth state
      if (response.requires_tenant_selection) {
        dispatch({ type: 'AUTH_FAILURE' });
        return {
          requires_tenant_selection: true,
          tenant_options: response.tenant_options
        };
      }

      // Normal login flow
      localStorage.setItem('token', response.token);
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: response.user,
          team: response.team,
          token: response.token,
        },
      });
      
      return {};
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE' });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateUser = (user: User) => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  const switchTenant = async (tenantId: number) => {
    try {
      const response = await authService.switchTenant(tenantId);
      dispatch({
        type: 'SWITCH_TENANT',
        payload: {
          tenant: response.tenant,
          token: response.token,
        },
      });
    } catch (error) {
      console.error('Switch tenant error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ state, login, logout, updateUser, switchTenant }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};