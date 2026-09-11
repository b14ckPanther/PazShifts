import type { StationRole } from '@yellowshifts/types';

/** Shared presentation/server rule; database policies enforce the same boundary. */
export function canManageMember(
  actor: { currentUserId: string; isPlatformAdmin: boolean; canManage: boolean },
  target: { userId: string; role: StationRole },
  requestedRole: StationRole = target.role
): boolean {
  if (!actor.canManage || actor.currentUserId === target.userId) return false;
  if (!['ADMIN', 'SHIFT_MANAGER', 'WORKER'].includes(requestedRole)) return false;
  return actor.isPlatformAdmin || (target.role !== 'ADMIN' && requestedRole !== 'ADMIN');
}
