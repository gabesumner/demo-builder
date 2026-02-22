import { idbSaveImage } from './idbStorage';
import { saveImageToApi } from './apiStorage';

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Used for thumbnail generation only (Overview card preview, avatar)
export function compressImage(base64, maxDim = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const needsResize = img.width > maxDim || img.height > maxDim;
      const scale = needsResize ? maxDim / Math.max(img.width, img.height) : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

function toPngBlob(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(resolve, 'image/png');
    };
    img.src = base64;
  });
}

// Stores image as full-resolution PNG, returns an image ID.
// Local: saves to IndexedDB. Postgres: uploads to /api/images.
export async function storeImage(base64, isPostgres = false) {
  const blob = await toPngBlob(base64);
  if (isPostgres) {
    const { id } = await saveImageToApi(blob);
    return id;
  }
  const id = `img_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await idbSaveImage(id, blob);
  return id;
}

// Migrates legacy inline data: URI images to IDB (local) or server (Postgres).
// Returns { migrated, didMigrate }.
export async function migrateInlineImages(data, isPostgres = false) {
  let didMigrate = false;
  const migrated = { ...data };

  // fromTo side images
  for (const side of ['from', 'to']) {
    if (migrated.fromTo?.[side]?.image?.startsWith('data:')) {
      const id = await storeImage(migrated.fromTo[side].image, isPostgres);
      migrated.fromTo = {
        ...migrated.fromTo,
        [side]: { ...migrated.fromTo[side], image: id },
      };
      didMigrate = true;
    }
  }

  if (Array.isArray(migrated.storyboard)) {
    let boardChanged = false;
    const panels = await Promise.all(migrated.storyboard.map(async panel => {
      if (panel.image?.startsWith('data:')) {
        const id = await storeImage(panel.image, isPostgres);
        boardChanged = true;
        return { ...panel, image: id };
      }
      return panel;
    }));
    if (boardChanged) { migrated.storyboard = panels; didMigrate = true; }
  }

  if (Array.isArray(migrated.grid)) {
    let gridChanged = false;
    const rows = await Promise.all(migrated.grid.map(async row => {
      if (row.screenshot?.startsWith('data:')) {
        const id = await storeImage(row.screenshot, isPostgres);
        gridChanged = true;
        return { ...row, screenshot: id };
      }
      return row;
    }));
    if (gridChanged) { migrated.grid = rows; didMigrate = true; }
  }

  return { migrated, didMigrate };
}
