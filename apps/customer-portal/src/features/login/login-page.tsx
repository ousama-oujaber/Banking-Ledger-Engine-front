import { useState, useEffect, useCallback } from 'react';
import { useAuth, BruteForceError, InvalidCredentialsError } from '../../app/providers';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Countdown timer for brute-force lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const isLockedOut = lockoutSeconds > 0;

  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;

    setIsLoading(true);
    setError(undefined);

    try {
      await login(username, password);
    } catch (err: unknown) {
      if (err instanceof BruteForceError) {
        setLockoutSeconds(err.retryAfter);
        setError(`Too many attempts. Try again in ${formatCountdown(err.retryAfter)}.`);
      } else if (err instanceof InvalidCredentialsError) {
        setError('Invalid username or password.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-page">
      <form onSubmit={handleSubmit} className="login-form" data-testid="login-form">
        <h1 className="login-form__title">Banking Ledger Engine</h1>

        <input
          className="login-form__input"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          disabled={isLockedOut}
          data-testid="username-input"
        />
        <input
          className="login-form__input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLockedOut}
          data-testid="password-input"
        />

        {error && (
          <div className="login-form__error" role="alert" aria-live="polite">
            <p>{error}</p>
            {isLockedOut && (
              <p className="login-form__countdown">Retry in: {formatCountdown(lockoutSeconds)}</p>
            )}
          </div>
        )}

        <button
          className="login-form__submit"
          type="submit"
          disabled={isLoading || isLockedOut}
          data-testid="login-submit-btn"
        >
          {isLoading ? 'Logging in...' : isLockedOut ? 'Locked' : 'Login'}
        </button>
      </form>
    </div>
  );
}
