export function adaptJsonPayload(payload = {}) {
  return {
    ok: payload.ok === true,
    meta: payload.meta || {},
    data: {
      interface: Array.isArray(payload?.data?.interface) ? payload.data.interface : [],
      events: Array.isArray(payload?.data?.events) ? payload.data.events : [],
      dictionary: Array.isArray(payload?.data?.dictionary) ? payload.data.dictionary : [],
    },
  };
}
