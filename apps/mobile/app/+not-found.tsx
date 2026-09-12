import { Link } from 'expo-router';
import { Screen, Label } from '../src/ui';
export default function NotFound() {
  return (
    <Screen>
      <Label bold>המסך הזה עדיין לא זמין באפליקציה</Label>
      <Link href="/" accessibilityRole="link">
        <Label>חזרה לחשבון</Label>
      </Link>
    </Screen>
  );
}
