import { useCallback, useRef, useEffect } from 'react';
import { saveDemoData, flushDemoData } from './storage';
import { saveDriveDemoData } from './driveStorage';
import { saveDemoDataToApi } from './apiStorage';

export function useAutosave(demoId, { storage = 'local', driveFileId = null, getToken = null, onSaveStatus = null, onSaveComplete = null } = {}) {
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const savingRef = useRef(false);

  const doSave = useCallback(async (data) => {
    if (storage === 'local') {
      await saveDemoData(demoId, data);
      onSaveStatus?.('saved');
    } else if (storage === 'drive' && driveFileId && getToken) {
      if (savingRef.current) return; // skip if a save is already in-flight
      savingRef.current = true;
      onSaveStatus?.('saving');
      try {
        const token = await getToken();
        const result = await saveDriveDemoData(token, driveFileId, data);
        // Also save an IndexedDB shadow copy as safety net
        await saveDemoData(demoId, data);
        onSaveStatus?.('saved');
        return result;
      } catch (err) {
        console.error('Drive save failed, falling back to IndexedDB:', err);
        await saveDemoData(demoId, data);
        onSaveStatus?.('error');
      } finally {
        savingRef.current = false;
      }
    } else if (storage === 'postgres') {
      if (savingRef.current) return;
      savingRef.current = true;
      onSaveStatus?.('saving');
      try {
        const result = await saveDemoDataToApi(demoId, data);
        onSaveStatus?.('saved');
        onSaveComplete?.(result.lastModified);
      } catch (err) {
        console.error('API save failed:', err);
        onSaveStatus?.('error');
      } finally {
        savingRef.current = false;
      }
    }
  }, [demoId, storage, driveFileId, getToken, onSaveStatus, onSaveComplete]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      // Sync-only save to localStorage for reliable beforeunload/unmount
      flushDemoData(demoId, pendingRef.current);
      pendingRef.current = null;
    }
  }, [demoId]);

  const debounceMs = (storage === 'drive' || storage === 'postgres') ? 2000 : 400;

  const save = useCallback((data) => {
    pendingRef.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave(data);
      pendingRef.current = null;
      timerRef.current = null;
    }, debounceMs);
  }, [doSave, debounceMs]);

  // Flush on unmount and on page close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => flush();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flush();
    };
  }, [flush]);

  return save;
}
