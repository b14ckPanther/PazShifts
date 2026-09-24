/** Isolated visual QA only. This does not write any lead to the backend. */
import { StationInterestEntry } from '../../src/acquisition/StationInterest';
import { Screen, Label, Surface, Field, Button } from '../../src/ui';
export default function StationInterestPreview() {
  return (
    <Screen>
      <Label english bold style={{ fontSize: 24 }}>
        YellowShifts
      </Label>
      <Label bold style={{ fontSize: 38 }}>
        טוב שחזרת.
      </Label>
      <Surface>
        <Field label="מספר הטלפון שלך" placeholder="050 000 0000" />
        <Field label="סיסמה" secureTextEntry />
        <Button title="כניסה לחשבון" onPress={() => {}} />
      </Surface>
      <StationInterestEntry send={async () => {}} />
    </Screen>
  );
}
