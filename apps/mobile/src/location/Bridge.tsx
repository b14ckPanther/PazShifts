import { useEffect } from 'react';
import { AppState, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { getNativeWorkerContext } from '@yellowshifts/database/public';
import { useWorker } from '../home/WorkerProvider';
import { supabase } from '../lib/supabase';
import { reconcileWorkerGeofences } from './runtime';
/** Native OS events do not grant navigation authority. Revalidate on every tap. */
export function LocationBridge() {
  const worker = useWorker();
  useEffect(() => {
    const sync=()=>void reconcileWorkerGeofences(worker.context.userId,worker.station?.id);
    sync();
    const listener=AppState.addEventListener('change',s=>{if(s==='active')sync();});
    return ()=>listener.remove();
  },[worker.context,worker.station?.id]);
  useEffect(()=>{
    let alive=true;
    const open=async(response:Notifications.NotificationResponse)=>{
      const data=response.notification.request.content.data;
      if(data?.kind!=='location-reminder' || !supabase) return;
      try {
        if(data.userId!==worker.context.userId || typeof data.stationId!=='string' || typeof data.createdAt!=='number' || Date.now()-data.createdAt>86400000 || data.createdAt>Date.now()) return;
        const fresh=await getNativeWorkerContext(supabase,worker.context.userId);
        if(!alive)return;
        if(!fresh.stations.some(s=>s.id===data.stationId)) {Alert.alert('התחנה אינה זמינה','ייתכן שההרשאה לתחנה השתנתה.');return;}
        worker.openStation(data.stationId,()=>router.navigate('/'));
      } catch { if(alive) Alert.alert('לא הצלחנו לפתוח את התזכורת','בדקו את החיבור ונסו שוב.'); }
      finally {await Notifications.clearLastNotificationResponseAsync();}
    };
    const subscription=Notifications.addNotificationResponseReceivedListener(r=>{void open(r);});
    void Notifications.getLastNotificationResponseAsync().then(r=>{if(alive && r)void open(r);}).catch(()=>{});
    return ()=>{alive=false;subscription.remove();};
  },[worker.context,worker.station?.id]);
  return null;
}
