// Shared demo accounts (published in the READMEs) are flagged by username.
// DEMO_USERNAMES is comma-separated; unset falls back to the published demo account.
const DEFAULT_DEMO_USERNAMES = "demo01";

const demoUsernames = (): Set<string> =>
  new Set(
    (process.env.DEMO_USERNAMES ?? DEFAULT_DEMO_USERNAMES)
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
  );

export const isDemoUsername = (username: string): boolean =>
  demoUsernames().has(username.trim().toLowerCase());
