import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getMobileHome, type MobileHome, type WorkerContext } from '@yellowshifts/database/public';
import { supabase } from '../lib/supabase';
import { selectStation } from './model';
type Value = {
  context: WorkerContext;
  station: WorkerContext['stations'][number] | undefined;
  select: (id: string) => void;
  data: MobileHome | null;
  error: boolean;
  refresh: () => void;
  loading: boolean;
};
const Worker = createContext<Value | null>(null);
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
  const generation = useRef(0);
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
        station: context.stations.find((s) => s.id === id),
        select: (next) => {
          if (next !== id && context.stations.some((s) => s.id === next)) {
            setData(null);
            setSelected(next);
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
