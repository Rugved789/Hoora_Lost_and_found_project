const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      ...options.headers,
    }
  };
  
  // Add JSON content type if body is not FormData
  if (options.body && !(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  }
  
  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// Helper to create authenticated request
export function createAuthRequest(getToken) {
  return async (endpoint, options = {}) => {
    let token = null;
    try {
      if (typeof getToken === 'function') {
        token = await getToken();
      }
    } catch (e) {
      // Ignore token retrieval errors in mock mode
    }

    return apiRequest(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : { 'x-user-id': '1' })
      }
    });
  };
}
