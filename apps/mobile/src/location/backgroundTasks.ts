import * as TaskManager from 'expo-task-manager';
import { GeofencingEventType, type LocationRegion } from 'expo-location';
import { TASK, handleGeofence, diagnostic } from './runtime';
// Must be evaluated at bundle load, including headless launches. No attendance mutations.
TaskManager.defineTask<{ eventType: GeofencingEventType; region: LocationRegion }>(
  TASK,
  async ({ data, error }) => {
    if (error || !data?.region?.identifier) {
      diagnostic('task-unavailable');
      return;
    }
    if (data.eventType !== GeofencingEventType.Enter && data.eventType !== GeofencingEventType.Exit)
      return;
    await handleGeofence(
      data.region.identifier,
      data.eventType === GeofencingEventType.Enter ? 'arrival' : 'exit'
    );
  }
);
