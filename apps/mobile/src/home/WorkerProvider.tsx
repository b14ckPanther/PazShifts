import { onAttendanceChanged } from '../nfc/events';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getMobileHome, type MobileHome, type WorkerContext } from '@yellowshifts/database/public';
import { supabase } from '../lib/supabase';
import { selectStation } from './model';
type Value = {
  context: WorkerContext;
  station: WorkerContext['stations'][number] | undefined;
  select: (id: string) => void;
  openStation: (id: string, action: () => void) => void;
  data: MobileHome | null;
  error: boolean;
  refresh: () => void;
  loading: boolean;
  proceed: (action: () => void) => void;
  setGuard: (guard: ((action: () => void) => void) | null) => void;
};
export const Worker = createContext<Value | null>(null);
export function WorkerProvider({
  context,
  children,
}: {
  context: WorkerContext;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [data, setData] = useState<MobileHome | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const id = selectStation(context.stations, selected);
  useEffect(
    () =>
      onAttendanceChanged((user) => {
        if (user === context.userId) setRevision((v) => v + 1);
      }),
    [context.userId]
  );
  const generation = useRef(0);
  const guard = useRef<((action: () => void) => void) | null>(null);
  const proceed = (action: () => void) => (guard.current ? guard.current(action) : action());
  useEffect(() => {
    let alive = true;
    const run = ++generation.current;
    setData((previous) => (previous?.stationId === id ? previous : null));
    setError(false);
    setLoading(true);
    if (!supabase || !id) {
      setLoading(false);
      return;
    }
    void getMobileHome(supabase, context.userId, id)
      .then((value) => {
        if (alive && run === generation.current) setData(value);
      })
      .catch(() => {
        if (alive && run === generation.current) {
          setData(null);
          setError(true);
        }
      })
      .finally(() => {
        if (alive && run === generation.current) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [context.userId, id, revision]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') setRevision((v) => v + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Worker.Provider
      value={{
        context,
        proceed,
        setGuard: (next) => {
          guard.current = next;
        },
        station: context.stations.find((s) => s.id === id),
        openStation: (next, action) => {
          if (context.stations.some((s) => s.id === next))
            proceed(() => {
              if (next !== id) {
                setData(null);
                setSelected(next);
              }
              action();
            });
        },
        select: (next) => {
          if (next !== id && context.stations.some((s) => s.id === next)) {
            proceed(() => {
              setData(null);
              setSelected(next);
            });
          }
        },
        data: data?.stationId === id ? data : null,
        error,
        loading,
        refresh: () => setRevision((v) => v + 1),
      }}
    >
      {children}
    </Worker.Provider>
  );
}
export function useWorker() {
  const value = useContext(Worker);
  if (!value) throw Error('Worker provider required');
  return value;
}
