/** The sender for agent email: MAIL_FROM's address, shown as "<Store> via PowerProof" */

const NAME_UNSAFE = /[<>"\r\n,;]/g;

export function fromAddress(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.MAIL_FROM ?? "";
  return raw.match(/<([^>]+)>/)?.[1] ?? (raw.includes("@") ? raw.trim() : null);
}

export function agentEnv(displayName: string, env: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const addr = fromAddress(env);
  if (!addr) return env;
  const name = `${displayName.replace(NAME_UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 60)} via PowerProof`;
  return { ...env, MAIL_FROM: `"${name}" <${addr}>` };
}
