import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'cyberaudit_token';
const USER_KEY  = 'cyberaudit_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  });

  const login = useCallback((userData, jwt) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem(USER_KEY,  JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, jwt);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
