import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/stoat';
import { stoatApi, ApiConfig } from '../services/stoatApi';

interface AuthContextType {
  currentUser: User | null;
  sessionToken: string;
  isAuthenticated: boolean;
  isPrivileged: boolean;
  isLoading: boolean;
  error: string | null;
  apiConfig: ApiConfig;
  mfaTicket: string | null;
  isImpersonating: boolean;
  originalAdminToken: string | null;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<boolean>;
  submitMfa: (code: string, type?: 'totp_code' | 'password' | 'recovery_code') => Promise<boolean>;
  logout: () => void;
  recheckPermissions: () => Promise<void>;
  updateApiConfig: (config: Partial<ApiConfig>) => void;
  loadDemoSession: (role?: 'admin' | 'unprivileged') => void;
  startImpersonation: (token: string, targetUser?: User) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string>(stoatApi.getConfig().sessionToken);
  const [isPrivileged, setIsPrivileged] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(stoatApi.getConfig());
  const [originalAdminToken, setOriginalAdminToken] = useState<string | null>(
    () => sessionStorage.getItem('dawnchat_original_admin_token')
  );

  const isImpersonating = Boolean(originalAdminToken);

  const checkUserPrivilege = useCallback(async (token?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeToken = (token || sessionToken || '').trim();
      if (!activeToken || activeToken === 'undefined' || activeToken === 'null') {
        setCurrentUser(null);
        setIsPrivileged(false);
        setIsLoading(false);
        return;
      }

      stoatApi.setToken(activeToken);

      // If we are actively impersonating and have the target user cached, use it directly
      const storedAdminToken = sessionStorage.getItem('dawnchat_original_admin_token');
      const storedImpersonatedUser = sessionStorage.getItem('dawnchat_impersonated_user');
      if (storedAdminToken && storedImpersonatedUser) {
        try {
          const parsed = JSON.parse(storedImpersonatedUser) as User;
          if (parsed && parsed._id) {
            setCurrentUser(parsed);
            setIsPrivileged(true);
            setIsLoading(false);
            return;
          }
        } catch {
          // Fall through to live verification
        }
      }

      const user = await stoatApi.fetchSelf();
      setCurrentUser(user);

      // If user is privileged OR we are actively impersonating from an admin session
      if (user.privileged === true || Boolean(storedAdminToken)) {
        setIsPrivileged(true);
      } else {
        setIsPrivileged(false);
      }
    } catch (err: unknown) {
      console.warn('Session verification notice:', err instanceof Error ? err.message : String(err));
      setCurrentUser(null);
      setIsPrivileged(false);
      // Clean up stale or invalid session token from storage so it does not persist broken state
      stoatApi.setToken('');
      setSessionToken('');
      localStorage.removeItem('dawnchat_admin_config');
      if (token || sessionToken) {
        setError(err instanceof Error ? err.message : 'Invalid session token or connection failure');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken && sessionToken !== 'undefined' && sessionToken !== 'null') {
      checkUserPrivilege(sessionToken);
    } else {
      setIsLoading(false);
    }
  }, [checkUserPrivilege, sessionToken]);

  const loginWithCredentials = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setMfaTicket(null);
    try {
      const res = await stoatApi.login(email, password, 'DawnChat Admin Console');

      if (res.result === 'MFA' && res.ticket) {
        setMfaTicket(res.ticket);
        setIsLoading(false);
        return false;
      }

      if (res.result === 'Disabled') {
        throw new Error('This account has been disabled.');
      }

      if (res.token) {
        setSessionToken(res.token);
        stoatApi.setToken(res.token);
        await checkUserPrivilege(res.token);
        return true;
      }

      throw new Error('Unexpected login response from DawnChat API.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoading(false);
      return false;
    }
  };

  const loginWithToken = async (token: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const cleanToken = token.trim();
      setSessionToken(cleanToken);
      stoatApi.setToken(cleanToken);
      await checkUserPrivilege(cleanToken);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Token verification failed');
      setIsLoading(false);
      return false;
    }
  };

  const submitMfa = async (code: string, type: 'totp_code' | 'password' | 'recovery_code' = 'totp_code'): Promise<boolean> => {
    if (!mfaTicket) return false;
    setIsLoading(true);
    setError(null);
    try {
      const mfaPayload: { totp_code?: string; password?: string; recovery_code?: string } = {};
      mfaPayload[type] = code;

      const res = await stoatApi.completeMfa(mfaTicket, mfaPayload);
      if (res.token) {
        setSessionToken(res.token);
        stoatApi.setToken(res.token);
        setMfaTicket(null);
        await checkUserPrivilege(res.token);
        return true;
      }
      throw new Error('MFA verification did not return session token.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid MFA code');
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setSessionToken('');
    setCurrentUser(null);
    setIsPrivileged(false);
    setError(null);
    setMfaTicket(null);
    stoatApi.setToken('');
    localStorage.removeItem('dawnchat_admin_config');
    setApiConfig(stoatApi.getConfig());
  };

  const recheckPermissions = async () => {
    if (sessionToken) {
      await checkUserPrivilege(sessionToken);
    }
  };

  const updateApiConfig = (newConfig: Partial<ApiConfig>) => {
    stoatApi.saveConfig(newConfig);
    const updated = stoatApi.getConfig();
    setApiConfig(updated);
  };

  const loadDemoSession = (role: 'admin' | 'unprivileged' = 'admin') => {
    stoatApi.setDemoMode(true);
    const demoToken = role === 'admin' ? 'demo_token_privileged_scott' : 'demo_token_unprivileged_alice';
    setSessionToken(demoToken);
    stoatApi.setToken(demoToken);
    setApiConfig(stoatApi.getConfig());
    checkUserPrivilege(demoToken);
  };

  const startImpersonation = async (impersonationToken: string, targetUser?: User) => {
    // Save current admin token if not already impersonating
    if (!originalAdminToken) {
      sessionStorage.setItem('dawnchat_original_admin_token', sessionToken);
      setOriginalAdminToken(sessionToken);
    }

    if (targetUser) {
      sessionStorage.setItem('dawnchat_impersonated_user', JSON.stringify(targetUser));
      setCurrentUser(targetUser);
    }

    setSessionToken(impersonationToken);
    stoatApi.setToken(impersonationToken);
    setIsPrivileged(true); // Maintain admin console access while in impersonation mode

    if (!targetUser) {
      await checkUserPrivilege(impersonationToken);
    }
  };

  const stopImpersonating = async () => {
    const adminToken = originalAdminToken || sessionStorage.getItem('dawnchat_original_admin_token');
    sessionStorage.removeItem('dawnchat_original_admin_token');
    sessionStorage.removeItem('dawnchat_impersonated_user');
    setOriginalAdminToken(null);

    if (adminToken) {
      setSessionToken(adminToken);
      stoatApi.setToken(adminToken);
      await checkUserPrivilege(adminToken);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        sessionToken,
        isAuthenticated: !!currentUser,
        isPrivileged,
        isLoading,
        error,
        apiConfig,
        mfaTicket,
        isImpersonating,
        originalAdminToken,
        loginWithCredentials,
        loginWithToken,
        submitMfa,
        logout,
        recheckPermissions,
        updateApiConfig,
        loadDemoSession,
        startImpersonation,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
