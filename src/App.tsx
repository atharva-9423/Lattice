import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { api, getStoredToken, getStoredUser } from './api/client';
import type { UserInfo } from './api/types';
import { ToastProvider } from './components/Toast';
import { CustomCursor } from './motion/cursor';
import { IntroOverlay } from './motion/pageTransition';
import { AppRoutes } from './routes';

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(() => getStoredUser());

  useEffect(() => {
    const token = getStoredToken();
    if (token && !user) {
      api
        .me()
        .then((u) => setUser(u))
        .catch(() => setUser(null));
    }
  }, [user]);

  return (
    <BrowserRouter>
      <ToastProvider>
        <IntroOverlay />
        <CustomCursor />
        <AppRoutes
          user={user}
          onLogin={(u) => setUser(u)}
          onLogout={() => setUser(null)}
        />
      </ToastProvider>
    </BrowserRouter>
  );
}
