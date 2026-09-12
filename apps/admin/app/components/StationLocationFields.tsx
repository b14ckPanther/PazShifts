export function StationLocationFields({
  latitude,
  longitude,
  radius = 50,
}: {
  latitude?: number | null;
  longitude?: number | null;
  radius?: number;
}) {
  return (
    <fieldset
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: 16,
        margin: '16px 0',
        minWidth: 0,
      }}
    >
      <legend>מיקום התחנה לדיווח נוכחות</legend>
      <p style={{ fontSize: 13, color: '#475569' }}>
        העתיקו קו רוחב וקו אורך מנקודת התחנה במפה. ברירת המחדל: 50 מטר. מומלץ לבדוק את הטווח פיזית
        בתחנה.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 12,
        }}
      >
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
          <label key={field.name} style={{ display: 'grid', gap: 6, minWidth: 0, fontSize: 13 }}>
            {field.label}
            <input
              name={field.name}
              id={'station-' + field.name}
              type="number"
              dir="ltr"
              step={field.name === 'attendanceRadiusM' ? '1' : 'any'}
              required
              min={field.min}
              max={field.max}
              defaultValue={field.value ?? ''}
              style={{
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                fontSize: 16,
                minHeight: 44,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: 10,
                color: '#111827',
                background: '#fff',
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
