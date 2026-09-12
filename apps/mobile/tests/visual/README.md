# Isolated native visual fixtures

`Preview.tsx` injects fixture readers/savers through WeekApi. It never mutates Supabase. Width controls are exact content widths (320/390/430 points), not claims that every matching physical device was tested.

For a local development build only, temporarily create `apps/mobile/app/preview.tsx`:

```tsx
import { Redirect } from 'expo-router';
import Preview from '../tests/visual/Preview';
export default function PreviewRoute() {
  return __DEV__ ? <Preview /> : <Redirect href="/login" />;
}
```

Open `yellowshifts:///preview`. Remove this temporary route when finished and before any commit/export. The route is intentionally absent from the delivered app so fixture data is not bundled in release builds. A Pro Max simulator can display all three widths. Scenarios: mixed shifts/availability, empty, unpublished, all available and a save failure. All simulated saves remain in memory. The preview assumes the existing public Supabase configuration is present so normal screen loading guards remain unchanged.

## Hours

Use the same temporary-route pattern with `HoursPreview` and the route name `hours-preview`. Its reader uses the existing classification engine with isolated records; scenarios include regular, mixed, sparse, empty, active, error and overnight, plus a 93-day range toggle. Remove the temporary route before committing/exporting. Fixtures never write to Supabase.
