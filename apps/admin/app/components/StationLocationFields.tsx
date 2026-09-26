import type { ReactNode } from 'react';
import './station-location.css';

export function StationLocationFields({
  latitude,
  longitude,
  radius = 50,
  children,
}: {
  latitude?: number | null;
  longitude?: number | null;
  radius?: number;
  children?: ReactNode;
}) {
  return (
    <fieldset className="ys-fieldset station-location-fields">
      <legend>מיקום התחנה לדיווח נוכחות</legend>
      <p className="station-location-help">
        העתיקו קו רוחב וקו אורך מנקודת התחנה במפה. ברירת המחדל: 50 מטר. מומלץ לבדוק את הטווח פיזית
        בתחנה.
      </p>
      <div className="ys-form-grid">
        {[
          { name: 'latitude', label: 'קו רוחב', value: latitude, min: -90, max: 90 },
          { name: 'longitude', label: 'קו אורך', value: longitude, min: -180, max: 180 },
          {
            name: 'attendanceRadiusM',
            label: 'רדיוס מותר (מטר)',
            value: radius,
            min: 30,
            max: 200,
          },
        ].map((field) => (
          <div key={field.name} className="ys-form-field">
            <label className="ys-label" htmlFor={'station-' + field.name}>
              {field.label}
              <span className="ys-label-required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              className="ys-input ys-num"
              name={field.name}
              id={'station-' + field.name}
              type="number"
              inputMode="decimal"
              dir="ltr"
              step={field.name === 'attendanceRadiusM' ? '1' : 'any'}
              required
              min={field.min}
              max={field.max}
              defaultValue={field.value ?? ''}
            />
          </div>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
