import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Universal API Fetch Interceptor: Ensures cross-device cookie + Bearer token resilience
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.pathname + input.search;
    } else if (input && typeof input === 'object' && 'url' in input) {
      url = (input as Request).url;
    }

    if (url.startsWith('/api') || url.includes('/api/')) {
      const token = localStorage.getItem('civora_token');
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));

      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }

      init = {
        ...init,
        credentials: init?.credentials || 'include',
        headers,
      };
    }

    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
