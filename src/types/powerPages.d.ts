// Power Pages injects Microsoft.Dynamic365.Portal on the window at runtime.
// Auth is server-side (session cookies). The objects below are read-only.

interface PowerPagesUser {
  userName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Dataverse contact GUID for the signed-in portal user. */
  contactId?: string;
  /** Web role names assigned to this user. */
  userRoles?: string[];
}

interface PowerPagesPortal {
  User?: PowerPagesUser;
  version?: string;
  type?: string;
  id?: string;
  geo?: string;
  tenant?: string;
}

interface PowerPagesDynamicsNamespace {
  Portal?: PowerPagesPortal;
}

interface PowerPagesMicrosoftNamespace {
  Dynamic365?: PowerPagesDynamicsNamespace;
}

declare global {
  interface Window {
    Microsoft?: PowerPagesMicrosoftNamespace;
  }
}

export type { PowerPagesUser, PowerPagesPortal };
