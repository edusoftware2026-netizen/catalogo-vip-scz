import React, { useState, useEffect } from 'react';
import { CatalogApp } from './pages/CatalogApp';
import { AdminApp } from './pages/AdminApp';

/**
 * Enrutador principal de la aplicación:
 * Separa de forma 100% independiente las dos Mini Apps de Telegram:
 * 1. Mini App Catálogo VIP: ruta /catalogo (o raíz /)
 * 2. Mini App Panel Administrativo: ruta /admin (o hash #admin)
 */
export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === 'undefined') return '/catalogo';
    const raw = (window.location.pathname || '/catalogo').replace(/\\/g, '/');
    return raw === '/' ? '/catalogo' : raw;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const raw = (window.location.pathname || '/catalogo').replace(/\\/g, '/');
      setCurrentPath(raw === '/' ? '/catalogo' : raw);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const isAdminRoute =
    currentPath.startsWith('/admin') ||
    (typeof window !== 'undefined' && window.location.hash.startsWith('#admin'));

  // Mini App 2: Panel Administrativo exclusivo (con su propio login y gestión)
  if (isAdminRoute) {
    return <AdminApp />;
  }

  // Mini App 1: Catálogo VIP exclusivo para clientes (con aceptación +18)
  return <CatalogApp />;
}
