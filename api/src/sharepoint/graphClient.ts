// Builds a Microsoft Graph client authenticated as the application
// (client-credentials flow) using the daemon app registration's secret.
//
// The same Graph client is reused across invocations within a warm Function
// instance; @azure/identity caches and refreshes the token internally.

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import { getConfig } from '../config.js';

let cachedClient: Client | null = null;

export const getGraphClient = (): Client => {
  if (cachedClient) return cachedClient;

  const cfg = getConfig();
  const credential = new ClientSecretCredential(
    cfg.tenantId,
    cfg.graphClientId,
    cfg.graphClientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  cachedClient = Client.initWithMiddleware({ authProvider });
  return cachedClient;
};
