import { useCallback, useRef, useEffect } from 'react';
import { saveDemoData, flushDemoData } from './storage';
import { saveDemoDataToApi } from './apiStorage';

export function useAutosave(demoId, { storage = 'local', onSaveStatus = null, onSaveComplete = null } = {}) {
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const savingRef = useRef(false);

  const doSave = useCallback(async (data) => {
    if (storage === 'local') {
      await saveDemoData(demoId, data);
      onSaveStatus?.('saved');
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
  }, [demoId, storage, onSaveStatus, onSaveComplete]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      flushDemoData(demoId, pendingRef.current);
      pendingRef.current = null;
    }
  }, [demoId]);

  const debounceMs = storage === 'postgres' ? 2000 : 400;

  const save = useCallback((data) => {
    pendingRef.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave(data);
      pendingRef.current = null;
      timerRef.current = null;
    }, debounceMs);
  }, [doSave, debounceMs]);

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
