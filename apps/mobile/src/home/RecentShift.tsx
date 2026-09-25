import type { MobileHome } from '@yellowshifts/database/public';
import { duration, localDate } from '@yellowshifts/reports';
import { Surface, Label, Button } from '../ui';
import { colors } from '../ui/theme';
import { nativeTime } from './Hero';
import { dateLabel } from '../week/model';
export function RecentShift({
  shift,
  onOpen,
}: {
  shift: NonNullable<MobileHome['latestClosed']>;
  onOpen: () => void;
}) {
  return (
    <Surface>
      <Label bold>המשמרת האחרונה שהסתיימה</Label>
      <Label>
        {shift.stationName} · {dateLabel(shift.date)}
      </Label>
      <Label english bold style={{ fontSize: 26, fontVariant: ['tabular-nums'] }}>
        {nativeTime(shift.start, shift.timezone)} — {nativeTime(shift.end, shift.timezone)}
      </Label>
      {localDate(new Date(shift.end), shift.timezone) !== shift.date && (
        <Label>
          יציאה ב-
          {dateLabel(localDate(new Date(shift.end), shift.timezone))}
        </Label>
      )}
      <Label>משך נוכחות: {duration(shift.seconds).slice(0, -3)} שעות · משמרת אחת</Label>
      {shift.corrected && <Label style={{ color: colors.secondary }}>תוקן על ידי מנהל</Label>}
      <Button secondary title="לפירוט המשמרת" onPress={onOpen} />
    </Surface>
  );
}
