import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// S04 Remediation: Origin-Safe API Fetch Interceptor
// Attaches authentication credentials ONLY to same-origin requests targeting /api
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      let rawUrl = '';
      if (typeof input === 'string') {
        rawUrl = input;
      } else if (input instanceof URL) {
        rawUrl = input.href;
      } else if (input && typeof input === 'object' && 'url' in input) {
        rawUrl = (input as Request).url;
      }

      // Explicit origin check: resolve relative to window.location.origin and ensure origins match exactly
      const resolvedUrl = new URL(rawUrl, window.location.origin);
      const isSameOrigin = resolvedUrl.origin === window.location.origin;

      if (isSameOrigin && resolvedUrl.pathname.startsWith('/api')) {
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
    } catch {
      // Fall through safely if URL parsing fails
    }

    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
