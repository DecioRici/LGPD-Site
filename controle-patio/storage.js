'use strict';

window.PatioStorage = (() => {
  const endpoint = '/api/patio';
  const pendingKey = 'controle-patio-cloud-pending-v1';
  let pending = null;
  let publicAccess = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey));
    if (saved && typeof saved.mutationId === 'string') pending = saved;
  } catch {}

  async function request(action, method = 'GET', body) {
    const response = await fetch(endpoint + '?action=' + action, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(35000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Não foi possível sincronizar os dados.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function configuration() {
    try {
      const data = await request('config');
      if (typeof data.configured !== 'boolean') throw new Error('Resposta de configuração inválida.');
      publicAccess = data.publicAccess === true;
      return data.configured ? 'cloud' : 'local';
    } catch (error) {
      // A página também pode ser aberta em um servidor estático sem a API.
      if (error.status === 404) return 'local';
      throw error;
    }
  }

  function clearPending() {
    pending = null;
    sessionStorage.removeItem(pendingKey);
  }

  async function retry() {
    if (!pending) return request('state');
    try {
      const state = await request('state', 'PUT', pending);
      clearPending();
      return state;
    } catch (error) {
      if (error.status === 409 || error.status === 400 || error.status === 413) clearPending();
      throw error;
    }
  }

  async function save(records, history, revision) {
    if (pending) throw new Error('Sincronize a alteração pendente antes de continuar.');
    const body = { records, history, revision, mutationId: crypto.randomUUID() };
    // Permite repetir a mesma gravação após queda de rede ou recarga da página.
    sessionStorage.setItem(pendingKey, JSON.stringify(body));
    pending = body;
    return retry();
  }

  return {
    configuration,
    isPublic: () => publicAccess,
    load: () => request('state'),
    save,
    retry,
    hasPending: () => Boolean(pending),
    login: password => request('login', 'POST', { password }),
    logout: () => request('logout', 'POST', {})
  };
})();
