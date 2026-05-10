import { useState } from 'react';
import { Brain } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'sign-in' | 'sign-up';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSignIn = mode === 'sign-in';
  const passwordsMatch = isSignIn || password === confirmPassword;
  const canSubmit = Boolean(email.trim() && password && passwordsMatch);

  const submit = async () => {
    if (!canSubmit) {
      if (!isSignIn && password !== confirmPassword) {
        setMessage('Les mots de passe ne correspondent pas.');
      }
      return;
    }

    setIsLoading(true);
    setMessage('');

    const { error } = isSignIn
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!isSignIn) {
      setMessage('Compte cree. Verifie tes emails si Supabase demande une confirmation.');
    }
  };

  return (
    <div className="min-h-screen app-shell flex items-center px-4">
      <div className="w-full max-w-md mx-auto app-panel rounded-lg p-6">
        <div className="w-14 h-14 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center mb-4">
          <Brain className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isSignIn ? 'Connexion' : 'Creer un compte'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Connecte-toi pour retrouver tes paquets personnels et acceder aux paquets publics.
        </p>

        <div className="space-y-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 border rounded-lg outline-none text-sm app-input"
          />

          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Mot de passe"
            className="w-full px-4 py-3 border rounded-lg outline-none text-sm app-input"
          />

          {!isSignIn && (
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              placeholder="Confirmer le mot de passe"
              className={`w-full px-4 py-3 border rounded-lg outline-none text-sm app-input ${
                confirmPassword && !passwordsMatch
                  ? 'app-input-error'
                  : 'border-gray-300'
              }`}
            />
          )}

          <button
            onClick={submit}
            disabled={isLoading || !canSubmit}
            className={`w-full py-3 rounded-lg font-semibold ${
              isLoading || !canSubmit
                ? 'bg-gray-300 text-gray-500'
                : 'app-primary'
            }`}
          >
            {isLoading ? 'Chargement...' : isSignIn ? 'Se connecter' : 'Creer le compte'}
          </button>
        </div>

        {message && (
          <p className="mt-4 text-sm text-center text-gray-600">{message}</p>
        )}

        <button
          onClick={() => {
            setMode(isSignIn ? 'sign-up' : 'sign-in');
            setMessage('');
            setConfirmPassword('');
          }}
          className="mt-6 w-full text-sm text-violet-700 font-medium"
        >
          {isSignIn ? 'Creer un compte' : 'J ai deja un compte'}
        </button>
      </div>
    </div>
  );
}
