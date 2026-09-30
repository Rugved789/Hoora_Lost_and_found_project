import React, { createContext, useContext, useState } from 'react';
import * as ClerkReact from '@clerk/clerk-react';

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
// A real Clerk key starts with pk_test_ or pk_live_ and does NOT have '...' placeholder
export const isClerkConfigured = 
  (rawKey.startsWith('pk_test_') || rawKey.startsWith('pk_live_')) && 
  !rawKey.includes('...') && 
  rawKey.length > 30;

// Mock Auth Context for development / testing without Clerk credentials
const MockAuthContext = createContext({
  isSignedIn: true,
  userId: '1',
  user: { id: 1, name: 'Rahul Sharma', email: 'rahul.sharma@sitnagpur.siu.edu.in' },
  getToken: async () => 'mock-token',
  signIn: () => {},
  signOut: () => {},
  switchUser: (id) => {}
});

const DEMO_USERS = {
  '1': { id: 1, name: 'Rahul Sharma', email: 'rahul.sharma@sitnagpur.siu.edu.in' },
  '2': { id: 2, name: 'Priya Patel', email: 'priya.patel@sitnagpur.siu.edu.in' },
  '3': { id: 3, name: 'Arjun Kumar', email: 'arjun.kumar@sitnagpur.siu.edu.in' }
};

export function AuthProvider({ children }) {
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [userId, setUserId] = useState('1');

  if (isClerkConfigured) {
    return (
      <ClerkReact.ClerkProvider publishableKey={rawKey}>
        {children}
      </ClerkReact.ClerkProvider>
    );
  }

  // Fallback Mock Auth Provider
  return (
    <MockAuthContext.Provider
      value={{
        isSignedIn,
        userId,
        user: DEMO_USERS[userId] || DEMO_USERS['1'],
        getToken: async () => 'mock-token',
        signIn: () => setIsSignedIn(true),
        signOut: () => setIsSignedIn(false),
        switchUser: (id) => setUserId(id)
      }}
    >
      <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5 flex items-center justify-between">
        <span>
          ⚡ <strong>Mock Auth Mode</strong>: Active as <strong>{DEMO_USERS[userId]?.name}</strong> (User ID: {userId})
        </span>
        <span className="text-amber-600 hidden sm:inline">
          (To use Clerk, set a valid key in <code>client/.env</code>)
        </span>
      </div>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useAuth() {
  if (isClerkConfigured) {
    return ClerkReact.useAuth();
  }
  return useContext(MockAuthContext);
}

export function SignedIn({ children }) {
  if (isClerkConfigured) {
    return <ClerkReact.SignedIn>{children}</ClerkReact.SignedIn>;
  }
  const { isSignedIn } = useContext(MockAuthContext);
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }) {
  if (isClerkConfigured) {
    return <ClerkReact.SignedOut>{children}</ClerkReact.SignedOut>;
  }
  const { isSignedIn } = useContext(MockAuthContext);
  return !isSignedIn ? <>{children}</> : null;
}

export function SignInButton({ children }) {
  if (isClerkConfigured) {
    return <ClerkReact.SignInButton>{children}</ClerkReact.SignInButton>;
  }
  const { signIn } = useContext(MockAuthContext);
  return (
    <span onClick={signIn}>
      {children || (
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Sign In
        </button>
      )}
    </span>
  );
}

export function UserButton() {
  if (isClerkConfigured) {
    return <ClerkReact.UserButton />;
  }

  const { user, signOut, switchUser, userId } = useContext(MockAuthContext);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full font-medium text-sm hover:bg-blue-100"
      >
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
          {user.name.charAt(0)}
        </span>
        <span>{user.name}</span>
        <span className="text-xs">▼</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-50">
          <div className="px-4 py-2 text-xs text-gray-500 border-b">
            Active: <strong>{user.name}</strong><br />
            <span className="text-gray-400">{user.email}</span>
          </div>
          <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Switch Demo User:
          </div>
          <button
            onClick={() => { switchUser('1'); setMenuOpen(false); }}
            className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-100 ${userId === '1' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700'}`}
          >
            User 1: Rahul Sharma
          </button>
          <button
            onClick={() => { switchUser('2'); setMenuOpen(false); }}
            className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-100 ${userId === '2' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700'}`}
          >
            User 2: Priya Patel
          </button>
          <button
            onClick={() => { switchUser('3'); setMenuOpen(false); }}
            className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-100 ${userId === '3' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700'}`}
          >
            User 3: Arjun Kumar
          </button>
          <div className="border-t my-1"></div>
          <button
            onClick={() => { signOut(); setMenuOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
