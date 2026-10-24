/**
 * Google settings for the Sheets connector. The browser needs the client id, an API key and the
 * Cloud project number for the Picker (all public); the client secret stays on the server.
 */

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function googleConfig(env: Record<string, string | undefined> = process.env): { clientId: string; clientSecret: string } | null {
  const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The first tab, columns A–Z, header plus 5,000 rows. Tab names are quoted the way Sheets expects. */
export function sheetRange(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'!A1:Z5001`;
}
