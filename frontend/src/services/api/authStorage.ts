export type AuthPanel = "admin" | "seller" | "delivery" | "customer";

export interface AuthStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storageForBrowser = (): AuthStorageLike => (globalThis as any).localStorage;

export const persistPanelSession = (
  panel: AuthPanel,
  token: unknown,
  userData?: unknown,
  storage: AuthStorageLike = storageForBrowser()
): boolean => {
  if (typeof token !== "string" || !token.trim()) return false;

  storage.setItem(`${panel}_authToken`, token.trim());
  if (userData) {
    storage.setItem(
      `${panel}_userData`,
      typeof userData === "string" ? userData : JSON.stringify(userData)
    );
  }
  storage.removeItem("authToken");
  storage.removeItem("userData");
  return true;
};

export const readPanelToken = (
  panel: AuthPanel,
  storage: AuthStorageLike = storageForBrowser()
): string | null => {
  const key = `${panel}_authToken`;
  const token = storage.getItem(key);
  if (token) return token;

  if (panel === "customer") {
    const legacyToken = storage.getItem("authToken");
    if (legacyToken) {
      storage.setItem(key, legacyToken);
      return legacyToken;
    }
  }
  return null;
};

export const readPanelUser = (
  panel: AuthPanel,
  storage: AuthStorageLike = storageForBrowser()
): any => {
  const key = `${panel}_userData`;
  let serialized = storage.getItem(key);
  if (!serialized && panel === "customer") {
    serialized = storage.getItem("userData");
    if (serialized) storage.setItem(key, serialized);
  }
  if (!serialized) return null;

  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
};

export const removePanelSession = (
  panel: AuthPanel,
  storage: AuthStorageLike = storageForBrowser()
): void => {
  storage.removeItem(`${panel}_authToken`);
  storage.removeItem(`${panel}_userData`);
  storage.removeItem("authToken");
  storage.removeItem("userData");
};
