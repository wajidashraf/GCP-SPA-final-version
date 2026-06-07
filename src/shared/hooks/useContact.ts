// src/shared/hooks/useContact.ts
// React hooks around contactService.

import { useEffect, useState } from 'react';
import type { Contact } from '../../types/contact';
import { getContactByEmail, getContactById } from '../services/contactService';

interface ContactState {
  contact: Contact | null;
  isLoading: boolean;
  error: string | null;
}

/** Fetch a contact by email (typically the logged-in user's email). */
export function useContactByEmail(email: string | null | undefined): ContactState {
  const [state, setState] = useState<ContactState>({
    contact: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!email) {
      setState({ contact: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    getContactByEmail(email)
      .then((c) => {
        if (cancelled) return;
        setState({ contact: c, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          contact: null,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  return state;
}

/** Fetch a contact by GUID. */
export function useContactById(contactId: string | null | undefined): ContactState {
  const [state, setState] = useState<ContactState>({
    contact: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!contactId) {
      setState({ contact: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    getContactById(contactId)
      .then((c) => {
        if (cancelled) return;
        setState({ contact: c, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          contact: null,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return state;
}
