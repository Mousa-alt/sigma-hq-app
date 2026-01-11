import { useState } from 'react';
import { COLORS, BRANDING, DASHBOARD_PASSWORD } from '../config';
import Icon from './Icon';

export default function PasswordGate({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    setTimeout(() => {
      if (password === DASHBOARD_PASSWORD) {
        // Store in session so refresh doesn't require re-auth
        sessionStorage.setItem('sigma_authenticated', 'true');
        onAuthenticate(true);
      } else {
        setError(true);
        setPassword('');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: COLORS.navy }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src={BRANDING.logoWhite} 
            alt="Sigma" 
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-white text-xl font-semibold">{BRANDING.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{BRANDING.subtitle}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Enter Access Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-sm text-white outline-none transition-colors placeholder:text-slate-500 ${
                  error ? 'border-red-500' : 'border-white/10 focus:border-blue-500'
                }`}
                autoFocus
              />
              <Icon 
                name="lock" 
                size={16} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" 
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                <Icon name="alert-circle" size={12} />
                Incorrect password
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: COLORS.blue }}
          >
            {loading ? (
              <>
                <Icon name="loader-2" size={16} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Icon name="log-in" size={16} />
                Access Dashboard
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Sigma Contractors © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
