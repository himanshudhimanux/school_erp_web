import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, setSessionLostHandler } from '../api/client.js';

const AuthContext = createContext(null);

/**
 * Session state: user, the schools they belong to and the active school's tenant context
 * (roles, effective permissions, modules). Permissions only shape the UI; the API enforces them.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, schools: [], tenant: null });

  const apply = useCallback((data) => {
    setAccessToken(data.accessToken);
    setState({ status: 'authenticated', user: data.user, schools: data.schools || [], tenant: data.tenant || null });
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    setState({ status: 'anonymous', user: null, schools: [], tenant: null });
  }, []);

  useEffect(() => {
    setSessionLostHandler(clear);
    refreshSession().then(apply).catch(clear);
  }, [apply, clear]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password, client: 'web' });
    apply(data);
    return data;
  }, [apply]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* session may already be gone */
    }
    clear();
  }, [clear]);

  const selectSchool = useCallback(async (schoolId) => {
    const data = await api.post('/auth/select-school', { schoolId });
    setAccessToken(data.accessToken);
    setState((s) => ({ ...s, tenant: data.tenant }));
  }, []);

  const reloadContext = useCallback(async () => {
    const tenant = await api.get('/context');
    setState((s) => ({ ...s, tenant }));
  }, []);

  const value = useMemo(() => {
    const perms = new Set(state.tenant?.permissions || []);
    const roles = state.tenant?.roles || [];
    const isStaff = roles.some((r) => ['school_owner', 'school_admin', 'principal', 'accountant', 'teacher', 'staff'].includes(r)) || (state.tenant?.customRoles?.length ?? 0) > 0;
    return {
      ...state,
      login,
      logout,
      selectSchool,
      reloadContext,
      isPlatformAdmin: state.user?.platformRole === 'super_admin',
      roles,
      isStaff,
      isParent: roles.includes('parent'),
      isStudent: roles.includes('student'),
      can: (...p) => p.every((x) => perms.has(x)),
      canAny: (...p) => p.some((x) => perms.has(x)),
      currency: state.tenant?.school?.currency || 'INR',
    };
  }, [state, login, logout, selectSchool, reloadContext]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
