import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { readStorage, writeStorage, removeStorage } from '../utils/storage';
import { getApi, isRemoteApiEnabled, setApiActorRole } from '../api';
import { setAccessToken } from '../api/config';
import { canEditXml } from '../auth/roles';
import {
  acquireEntraToken,
  initEntra,
  isEntraConfigured,
  loginWithEntra,
  logoutEntra,
  type EntraPublicConfig,
} from '../auth/entra';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isRemote: boolean;
  isEntra: boolean;
  isTestProfile: boolean;
  testEmail: string;
  testName: string;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  loginTest: () => Promise<void>;
  loginEntra: () => Promise<void>;
  logout: () => Promise<void>;
  canEdit: boolean;
  canSyncS3: boolean;
  canManageBrand: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>('auth_user', null));
  const [isEntra, setIsEntra] = useState(false);
  const [isTestProfile, setIsTestProfile] = useState(false);
  const [testEmail, setTestEmail] = useState('test@local');
  const [testName, setTestName] = useState('Test User');
  const [testToken, setTestToken] = useState('');
  const isRemote = isRemoteApiEnabled();

  useEffect(() => {
    setApiActorRole(user?.role);
    if (user) {
      writeStorage('auth_user', user);
    } else {
      removeStorage('auth_user');
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      let config: EntraPublicConfig | null = null;
      if (isRemoteApiEnabled()) {
        try {
          config = (await getApi().getAuthConfig?.()) ?? null;
        } catch {
          config = null;
        }
      }
      const entraOn = Boolean(config?.enabled && config.clientId);
      const envToken = (import.meta.env.VITE_TEST_TOKEN || '').trim();
      const testOn = Boolean(config?.testAuthEnabled || config?.profile === 'test' || envToken);
      const resolvedEmail = (config?.testEmail || 'test@local').trim();
      const resolvedName = (config?.testName || 'Test User').trim();
      if (!cancelled) {
        setIsTestProfile(testOn);
        setTestEmail(resolvedEmail);
        setTestName(resolvedName);
        setTestToken(envToken);
        setIsEntra(!testOn && (entraOn || (import.meta.env.VITE_ENTRA_ENABLED || '').toLowerCase() === 'true'));
      }
      if (testOn && envToken) {
        setAccessToken(envToken);
        try {
          const me = await getApi().me();
          if (!cancelled) {
            setApiActorRole(me.role);
            setUser({ ...me, authProvider: 'test' });
          }
        } catch {
          if (!cancelled) {
            setAccessToken(null);
            setUser(null);
          }
        }
        return;
      }
      try {
        await initEntra(config);
      } catch {
        /* local password login remains available */
      }
      if (!isRemoteApiEnabled() || cancelled) {
        return;
      }
      try {
        if (isEntraConfigured()) {
          await acquireEntraToken();
        }
        const me = await getApi().me();
        if (!cancelled) {
          setApiActorRole(me.role);
          setUser({ ...me, authProvider: entraOn ? 'entra' : 'remote' });
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTestSession = async (token: string) => {
    setAccessToken(token);
    const me = await getApi().me();
    setApiActorRole(me.role);
    setUser({ ...me, authProvider: 'test' });
  };

  const loginTest = async () => {
    const token = testToken.trim() || (import.meta.env.VITE_TEST_TOKEN || '').trim();
    if (token) {
      await applyTestSession(token);
      return;
    }
    throw new Error('Enter the test user email and password, then Sign In.');
  };

  const login = async (email: string, password: string, role: UserRole = 'Viewer') => {
    const session = await getApi().login({ email: email.trim(), password }, role);
    setApiActorRole(session.user.role);
    setUser({
      ...session.user,
      authProvider: session.user.authProvider === 'test' ? 'test' : isRemoteApiEnabled() ? 'remote' : 'local',
    });
  };

  const loginEntra = async () => {
    await loginWithEntra();
  };

  const logout = async () => {
    const entra = isEntraConfigured();
    try {
      await getApi().logout();
    } catch {
      /* still clear local session */
    } finally {
      setAccessToken(null);
      setApiActorRole(undefined);
      setUser(null);
    }
    if (entra) {
      await logoutEntra();
    }
  };

  const canEdit = canEditXml(user?.role);
  const canSyncS3 = user?.role === 'Administrator';
  const canManageBrand = user?.role === 'Administrator';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isRemote,
        isEntra,
        isTestProfile,
        testEmail,
        testName,
        login,
        loginTest,
        loginEntra,
        logout,
        canEdit,
        canSyncS3,
        canManageBrand,
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
