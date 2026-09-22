import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthService } from '@ble-frontend/auth';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authenticated = !!AuthService.getToken() && !AuthService.isTokenExpired();
    setIsAuthenticated(authenticated);
    setIsLoading(false);
    if (!authenticated) {
      navigate('/login');
    }
  }, [navigate]);

  const login = async (username: string, password: string) => {
    // POST /api/v1/auth/token
    const response = await fetch('/api/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw new Error('Invalid credentials');
    }
    const data = await response.json();
    AuthService.setToken(data.token);
    setIsAuthenticated(true);
    navigate('/');
  };

  const logout = () => {
    AuthService.clear();
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
