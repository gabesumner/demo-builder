import { createEmptyDemo, getThumbnailCache, setThumbnailCache } from './storage';

// --- Demo List ---

export async function getDemoListFromApi() {
  const res = await fetch('/api/demos');
  if (!res.ok) throw new Error('Failed to fetch demo list');
  return res.json();
}

// --- Demo Data ---

export async function getDemoDataFromApi(demoId) {
  const res = await fetch(`/api/demos/${demoId}`);
  if (res.status === 404) return { name: '', data: createEmptyDemo(), lastModified: Date.now() };
  if (!res.ok) throw new Error('Failed to fetch demo data');
  return res.json(); // { name, data, lastModified }
}

export async function saveDemoDataToApi(demoId, data) {
  const res = await fetch(`/api/demos/${demoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error('Failed to save demo data');
  return res.json(); // { lastModified }
}

// --- Create / Delete ---

export async function createDemoInApi(name) {
  const id = crypto.randomUUID();
  const data = createEmptyDemo();
  const res = await fetch('/api/demos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, data }),
  });
  if (!res.ok) throw new Error('Failed to create demo');
  return res.json(); // { id, name, lastModified, storage }
}

export async function deleteDemoFromApi(demoId) {
  const res = await fetch(`/api/demos/${demoId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('Failed to delete demo');
}

export async function updateDemoNameInApi(demoId, name) {
  const res = await fetch(`/api/demos/${demoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to update demo name');
  return res.json(); // { lastModified }
}

export async function checkPgModified(demoId, sinceTimestamp) {
  const res = await fetch(`/api/demos/${demoId}/meta`)
  if (!res.ok) return { modified: false }
  const { lastModified } = await res.json()
  return { modified: lastModified > sinceTimestamp, lastModified }
}

// Re-export thumbnail cache helpers — these stay in localStorage
export { getThumbnailCache, setThumbnailCache };
