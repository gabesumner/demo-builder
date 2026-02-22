import { idbGet, idbSave, idbDelete } from './idbStorage';

const DEMO_LIST_KEY = 'demoList';

export function getDemoList() {
  try {
    const list = JSON.parse(localStorage.getItem(DEMO_LIST_KEY)) || [];
    // Backward compat: default storage to 'local' for old entries
    return list.map(d => ({ storage: 'local', ...d }));
  } catch {
    return [];
  }
}

export function saveDemoList(list) {
  localStorage.setItem(DEMO_LIST_KEY, JSON.stringify(list));
}

export async function getDemoData(demoId) {
  // Check localStorage first — flush recovery (data written during emergency beforeunload)
  try {
    const flushed = localStorage.getItem(`demo_${demoId}`);
    if (flushed) {
      const data = JSON.parse(flushed);
      // Move to IndexedDB and clear localStorage
      localStorage.removeItem(`demo_${demoId}`);
      idbSave(demoId, data).catch(() => {}); // fire-and-forget
      return data;
    }
  } catch {
    localStorage.removeItem(`demo_${demoId}`);
  }
  // Normal path: read from IndexedDB
  try {
    const data = await idbGet(demoId);
    if (data) return data;
  } catch (err) {
    console.error('Failed to read from IndexedDB:', err);
  }
  return createEmptyDemo();
}

export async function saveDemoData(demoId, data) {
  try {
    await idbSave(demoId, data);
  } catch (e) {
    console.error('Failed to save demo data to IndexedDB:', e);
    return;
  }
  // Clear any flush recovery data
  localStorage.removeItem(`demo_${demoId}`);
  // Update lastModified in demo list
  const list = getDemoList();
  const idx = list.findIndex(d => d.id === demoId);
  if (idx !== -1) {
    list[idx].lastModified = Date.now();
    saveDemoList(list);
  }
}

// Sync-only save for beforeunload/unmount emergency flush
export function flushDemoData(demoId, data) {
  try {
    localStorage.setItem(`demo_${demoId}`, JSON.stringify(data));
  } catch {
    // Best effort — localStorage may be full, but this is a last resort
  }
}

export async function createDemo(name, storage = 'local') {
  const id = crypto.randomUUID();
  const list = getDemoList();
  list.push({ id, name, lastModified: Date.now(), storage });
  saveDemoList(list);
  if (storage === 'local') {
    await saveDemoData(id, createEmptyDemo());
  }
  return id;
}

export async function deleteDemo(demoId) {
  const list = getDemoList().filter(d => d.id !== demoId);
  saveDemoList(list);
  localStorage.removeItem(`demo_${demoId}`);
  try {
    await idbDelete(demoId);
  } catch {
    // Ignore — may not exist in IDB
  }
}

export function updateDemoName(demoId, name) {
  const list = getDemoList();
  const idx = list.findIndex(d => d.id === demoId);
  if (idx !== -1) {
    list[idx].name = name;
    saveDemoList(list);
  }
}

export async function exportDemos(demoIds) {
  const demos = [];
  for (const id of demoIds) {
    const list = getDemoList();
    const entry = list.find(d => d.id === id);
    if (!entry) continue;
    const data = await getDemoData(id);
    demos.push({ id: entry.id, name: entry.name, lastModified: entry.lastModified, data });
  }
  return { version: 1, demos };
}

export async function importDemos(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || !Array.isArray(parsed.demos)) throw new Error('Invalid file format');
  const list = getDemoList();
  let count = 0;
  for (const demo of parsed.demos) {
    const newId = crypto.randomUUID();
    list.push({ id: newId, name: demo.name, lastModified: demo.lastModified || Date.now() });
    await idbSave(newId, demo.data);
    if (demo.data?.overview) {
      setThumbnailCache(newId, demo.data.overview);
    }
    count++;
  }
  saveDemoList(list);
  return count;
}


export function getThumbnailCache(demoId) {
  try {
    return JSON.parse(localStorage.getItem(`thumb_${demoId}`));
  } catch {
    return null;
  }
}

export function setThumbnailCache(demoId, overview) {
  if (!overview) return;
  const { headline, thumbnailImage, gradientId, imageOffset } = overview;
  try {
    localStorage.setItem(`thumb_${demoId}`, JSON.stringify({ headline, thumbnailImage, gradientId, imageOffset }));
  } catch {
    // Ignore quota errors for cache
  }
}

export function createEmptyDemo() {
  return {
    overview: { headline: '', thumbnailImage: '', gradientId: 'sf-brand', imageOffset: { x: 50, y: 50 }, socialPostText: '', posterName: '', posterTitle: '', posterAvatar: '', posterAvatarOffset: { x: 50, y: 50 }, posterAvatarZoom: 1, posterAvatarIsLandscape: true },
    requirements: { items: [], goal: '' },
    fromTo: {
      from: { image: '', text: '' },
      to: { image: '', text: '' },
    },
    storyboard: [
      { label: 'Context', image: '', text: 'Here you\'re looking at...' },
      { label: 'Challenge', image: '', text: 'But the challenge is...' },
      { label: 'Solution 1', image: '', text: 'Thankfully...' },
      { label: 'Solution 2', image: '', text: 'Because of that...' },
      { label: 'Solution 3', image: '', text: 'Because of that...' },
      { label: 'Solution 4', image: '', text: 'Because of that...' },
      { label: 'Solution 5', image: '', text: 'Because of that.' },
      { label: 'Outcome', image: '', text: 'Until finally...' },
    ],
    outline: [
      { id: crypto.randomUUID(), text: 'In this demo I\'ll show you how...', order: 0 },
      { id: crypto.randomUUID(), text: 'Here you\'re looking at...', order: 1 },
      { id: crypto.randomUUID(), text: 'But the challenge is...', order: 2 },
      { id: crypto.randomUUID(), text: 'Thankfully...', order: 3 },
      { id: crypto.randomUUID(), text: 'Because of that...', order: 4 },
      { id: crypto.randomUUID(), text: 'Because of that...', order: 5 },
      { id: crypto.randomUUID(), text: 'Because of that...', order: 6 },
      { id: crypto.randomUUID(), text: 'Because of that.', order: 7 },
      { id: crypto.randomUUID(), text: 'Until finally...', order: 8 },
      { id: crypto.randomUUID(), text: 'Now you\'ve seen how...', order: 9 },
    ],
    grid: [],
    watch: { driveUrl: '', embedUrl: '' },
  };
}
