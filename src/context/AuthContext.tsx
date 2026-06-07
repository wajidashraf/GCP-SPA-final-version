import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getCurrentUser,
  getUserDisplayName,
  getUserInitials,
  isAuthenticated as isAuthedFn,
  login as loginFn,
  logout as logoutFn,
} from '../services/authService';
import { getContactByEmail } from '../shared/services/contactService';

export interface User {
  name: string;
  initials: string;
  email: string;
  /** Best-effort: full label of the user's company. Empty string if unresolved. */
  company: string;
  /** GUID of the contact's parent account (company). `null` until resolved. */
  companyAccountId: string | null;
  /** Web role names from Power Pages. */
  roles: string[];
  /** Dataverse contact GUID, resolved via getContactByEmail. `null` until resolved. */
  contactId: string | null;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (returnUrl?: string) => Promise<void>;
  logout: (returnUrl?: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildUserFromPortal = (): Omit<User, 'contactId' | 'companyAccountId'> | null => {
  const pp = getCurrentUser();
  if (!pp) return null;
  return {
    name: getUserDisplayName(),
    initials: getUserInitials(),
    email: pp.email ?? pp.userName ?? '',
    company: '',
    roles: pp.userRoles ?? [],
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  // Read portal user from window.Microsoft.Dynamic365.Portal and resolve contact.
  const hydrate = useCallback(async () => {
    const base = buildUserFromPortal();
    if (!base) {
      setUser(null);
      setLoading(false);
      return;
    }

    let contactId: string | null = null;
    let companyAccountId: string | null = null;
    let company = '';
    console.log('[AuthContext] portal user:', base);
    if (base.email) {
      try {
        const contact = await getContactByEmail(base.email);
        console.log('[AuthContext] contact resolved:', contact);
        contactId = contact?.contactId ?? null;
        companyAccountId = contact?.parentAccountId ?? null;
        // Company name comes back as the FormattedValue annotation on
        // _parentcustomerid_value in the same contact response (single hop).
        company = contact?.parentAccountName ?? '';
        if (!companyAccountId) {
          console.warn('[AuthContext] contact has no parentAccountId');
        }
      } catch (err) {
        console.warn('[AuthContext] contact lookup failed, contactId=null', err);
      }
    }
    console.log('[AuthContext] resolved → ', {
      contactId,
      companyAccountId,
      company,
    });

    setUser({ ...base, contactId, companyAccountId, company });
    setLoading(false);
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: isAuthedFn(),
      isLoading,
      login: loginFn,
      logout: logoutFn,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
