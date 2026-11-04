export function createIPC(port, handlers = {}) {
  let nextId = 1;
  let closed = false;
  const pending = new Map();

  const safePost = (msg) => {
    try {
      port.postMessage(msg);
    } catch {
    }
  };

  async function onMessage(data) {
    if (!data || typeof data !== 'object') return;
    const { id, type, method, params, result, error } = data;

    if (type === 'response') {
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result);
    } else if (type === 'request') {
      let reply;
      try {
        const fn = handlers[method];
        if (typeof fn !== 'function' || method === 'onEvent') {
          throw new Error(`Unknown IPC method: ${method}`);
        }
        reply = { type: 'response', id, result: await fn.apply(handlers, params || []) };
      } catch (e) {
        reply = { type: 'response', id, error: e?.message ?? String(e) };
      }
      safePost(reply);
    } else if (type === 'event') {
      try {
        handlers.onEvent?.(method, params);
      } catch (e) {
        console.error(`IPC event handler "${method}" threw:`, e);
      }
    }
  }

  if (typeof port.on === 'function') port.on('message', onMessage);
  else port.onmessage = (e) => onMessage(e.data);

  return {
    call(method, ...params) {
      if (closed) return Promise.reject(new Error('IPC closed'));
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        try {
          port.postMessage({ type: 'request', id, method, params });
        } catch (e) {
          pending.delete(id);
          reject(e);
        }
      });
    },

    emit(method, params) {
      if (closed) return;
      safePost({ type: 'event', method, params });
    },

    close(reason = new Error('IPC closed')) {
      if (closed) return;
      closed = true;
      port.off?.('message', onMessage);
      for (const p of pending.values()) p.reject(reason);
      pending.clear();
    },
  };
}
