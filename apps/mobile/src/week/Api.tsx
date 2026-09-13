import { reconcileWorkerGeofences } from '../location/runtime';
import { createContext, useContext } from 'react';
import {
  getMobileWorkerSchedule,
  getMobileAvailabilityWeek,
  saveMobileAvailability,
} from '@yellowshifts/database/public';
export const WeekApi = createContext({
  schedule: async (...args: Parameters<typeof getMobileWorkerSchedule>) => {
    const result = await getMobileWorkerSchedule(...args);
    void reconcileWorkerGeofences(args[1], args[2]);
    return result;
  },
  availability: getMobileAvailabilityWeek,
  save: saveMobileAvailability,
});
export const useWeekApi = () => useContext(WeekApi);
