async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => fetch("/api/health").then(json),
  npcs: () => fetch("/api/npcs").then(json),
  memory: (wallet) => fetch(`/api/memory/${wallet}`).then(json),
  chat: (wallet, npc, message) =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, npc, message }),
    }).then(json),
};
