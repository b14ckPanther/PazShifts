import { createContext, useContext } from 'react';
import {
  getMobileWorkerSchedule,
  getMobileAvailabilityWeek,
  saveMobileAvailability,
} from '@yellowshifts/database/public';
export const WeekApi = createContext({
  schedule: getMobileWorkerSchedule,
  availability: getMobileAvailabilityWeek,
  save: saveMobileAvailability,
});
export const useWeekApi = () => useContext(WeekApi);
