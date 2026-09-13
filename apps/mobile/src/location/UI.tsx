import { useEffect, useState } from 'react';
import { AppState, Linking, Switch, View, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Label, Surface, Button, Message } from '../ui';
import { Sheet } from '../week/Patterns';
import { useWorker } from '../home/WorkerProvider';
import { colors } from '../ui/theme';
import { prepareNotificationChannel } from '../notifications/device';
import { disabled, type Preferences } from './model';
import { getPreferences, savePreferences, permissionState, reconcileWorkerGeofences } from './runtime';
const descriptions: Record<string,string> = {
  ready:'תזכורות מיקום מוכנות לפעולה', services:'שירותי המיקום כבויים במכשיר', notifications:'יש לאפשר התראות כדי לקבל תזכורות', foreground:'נדרשת הרשאת מיקום', background:'לתזכורות כשהאפליקציה סגורה, יש לאפשר מיקום תמיד', precise:'לצורך תזכורת מדויקת בהגעה לתחנה נדרש מיקום מדויק.', unavailable:'תזכורות מיקום אינן זמינות במכשיר זה',
};
export function LocationPreferences() {
  const {context,station} = useWorker();
  const [prefs,setPrefs] = useState<Preferences>(disabled), [status,setStatus] = useState(''), [sheet,setSheet] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(false);
  const refresh = async () => {setPrefs(await getPreferences(context.userId)); setStatus(await permissionState());};
  useEffect(() => {void refresh().catch(() => setError(true)); const sub=AppState.addEventListener('change',s=>{if(s==='active') void refresh().catch(()=>setError(true));}); return ()=>sub.remove();},[context.userId]);
  const update = async (next: Preferences) => {
    setBusy(true); setError(false);
    try {await savePreferences(context.userId,next);setPrefs(next); await reconcileWorkerGeofences(context.userId,station?.id); await refresh();} catch {setError(true);} finally {setBusy(false);}
  };
  const enable = async () => {
    setBusy(true);setError(false);
    try {
      await prepareNotificationChannel();
      if (!(await Notifications.getPermissionsAsync()).granted) await Notifications.requestPermissionsAsync();
      if (!(await Location.getForegroundPermissionsAsync()).granted) await Location.requestForegroundPermissionsAsync();
      if ((await Location.getForegroundPermissionsAsync()).granted && !(await Location.getBackgroundPermissionsAsync()).granted) {
        const proceed = await new Promise<boolean>(resolve=>Alert.alert('גם כשהאפליקציה אינה פתוחה','במסך הבא יש לבחור הרשאת מיקום תמיד כדי לקבל תזכורות ברקע. המיקום אינו נשמר כהיסטוריה.',[{text:'לא עכשיו',onPress:()=>resolve(false),style:'cancel'},{text:'המשך',onPress:()=>resolve(true)}],{cancelable:false}));
        if(proceed) await Location.requestBackgroundPermissionsAsync();
      }
      if (await permissionState() === 'ready') await update({arrival:true,exit:true});
      await refresh(); setSheet(false);
    } catch {setError(true);} finally {setBusy(false);}
  };
  return <Surface><View style={{gap:16}}>
    <Label bold style={{fontSize:22}}>תזכורות לפי מיקום</Label>
    <Label>מגיעים, סורקים. יוצאים, זוכרים לדווח.</Label>
    <Label style={{fontSize:14}}>{prefs.arrival || prefs.exit ? descriptions[status] : 'כבוי במכשיר זה · לבחירתך בלבד'}</Label>
    {(prefs.arrival || prefs.exit) ? <>
      {(['arrival','exit'] as const).map(kind=><View key={kind} style={{flexDirection:'row',alignItems:'center',gap:12}}><Label style={{flex:1}}>{kind==='arrival'?'תזכורת בהגעה למשמרת':'תזכורת ביציאה בזמן משמרת'}</Label><Switch accessibilityLabel={kind==='arrival'?'תזכורת בהגעה':'תזכורת ביציאה'} value={prefs[kind]} disabled={busy} trackColor={{true:colors.yellow}} onValueChange={value=>void update({...prefs,[kind]:value})}/></View>)}
      {status!=='ready' && <Button secondary title="פתיחת הגדרות המכשיר" onPress={()=>void Linking.openSettings()}/>}
    </> : <Button secondary title="היכרות והפעלה" onPress={()=>setSheet(true)}/>}
    {status && status!=='ready' && !prefs.arrival && !prefs.exit && <Label style={{fontSize:14}}>{descriptions[status]}</Label>}
    {error && <Message>לא הצלחנו לעדכן את התזכורות. נסו שוב.</Message>}
    <Label style={{fontSize:13}}>במכשיר זה בלבד. אין דיווח נוכחות אוטומטי. יש לסרוק את תג ה-NFC בכל כניסה ויציאה.</Label>
    <Sheet visible={sheet} close={()=>{if(!busy)setSheet(false);}} title="תזכורות לפי מיקום">
      <View style={{gap:20}}><Label>YellowShifts יכול להזכיר לך לסרוק את תג ה-NFC כשאתה מגיע לתחנה, ולהזכיר לך לדווח יציאה אם עזבת בזמן שמשמרת עדיין פעילה.</Label>
      <Surface><Label>המיקום משמש לתזכורות בלבד. האפליקציה לא שומרת היסטוריית מיקום ולא עוקבת אחרי המסלול שלך.</Label></Surface>
      <Label>תחילה נבקש הרשאת מיקום בזמן השימוש. לאחר מכן תוכל לבחור לאפשר תזכורות גם ברקע. אפשר לכבות בכל עת.</Label>
      <Button title="הפעל תזכורות לפי מיקום" busy={busy} onPress={()=>void enable()}/><Button secondary title="לא עכשיו" disabled={busy} onPress={()=>setSheet(false)}/></View>
    </Sheet>
  </View></Surface>;
}
