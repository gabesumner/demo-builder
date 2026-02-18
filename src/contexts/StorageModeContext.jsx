import { createContext, useContext, useEffect, useState } from 'react';

const StorageModeContext = createContext({ mode: 'local', loading: true });

export function StorageModeProvider({ children }) {
  const [mode, setMode] = useState('local');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.ok ? res.json() : null)
      .then(config => {
        if (config?.storageMode === 'postgres') setMode('postgres');
      })
      .catch(() => {}) // stay in local mode on error
      .finally(() => setLoading(false));
  }, []);

  return (
    <StorageModeContext.Provider value={{ mode, loading }}>
      {children}
    </StorageModeContext.Provider>
  );
}

export function useStorageMode() {
  return useContext(StorageModeContext);
}
