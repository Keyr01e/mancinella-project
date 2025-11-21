import React, { useState } from 'react';
import { API_URL } from './config';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      let url, body, headers;

      if (mode === 'login') {
        url = `${API_URL}/api/v1/users/token`;

        body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      } else {
        url = `${API_URL}/api/v1/users/register`;

        body = JSON.stringify({ username, password });
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(url, { method: 'POST', headers, body });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let token = data.access_token || data.token;
      if (mode === 'register' && !token) {
        // auto-login after register
        const loginRes = await fetch(`${API_URL}/api/v1/users/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username, password }),
        });

        const loginData = await loginRes.json();
        token = loginData.access_token || loginData.token;
      }

      if (!token) throw new Error('Token missing');
      const user_id = data.user_id || data.id || (data.user && data.user.id);
      localStorage.setItem('token', `Bearer ${token}`);
      if (user_id) localStorage.setItem('user_id', String(user_id));
      onLogin({ token: `Bearer ${token}`, user_id });
    } catch (err) {
      console.error(err);
      setError('Invalid credentials or registration failed');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2b2d31] text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1e1f22] p-8 rounded-2xl shadow-xl w-80 space-y-4"
      >
        <h2 className="text-2xl font-bold text-center mb-4">
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </h2>
        <input
          className="w-full p-2 rounded bg-[#313338] focus:outline-none"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="w-full p-2 rounded bg-[#313338] focus:outline-none"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded font-semibold"
          type="submit"
        >
          {mode === 'login' ? 'Login' : 'Register'}
        </button>
        <p
          className="text-sm text-center text-gray-400 cursor-pointer hover:text-gray-200"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </p>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  );
}