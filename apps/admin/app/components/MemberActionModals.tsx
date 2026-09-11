'use client';

import React, { useState, useTransition } from 'react';
import { Button, Alert, Badge, Spinner } from '@yellowshifts/ui';
import { ShieldCheckIcon, PowerIcon, CloseIcon } from '@yellowshifts/icons';
import type { StationRole, MembershipStatus, StationMemberWithProfile } from '@yellowshifts/types';
import { updateMemberRoleAction, updateMemberStatusAction } from '../actions/stations';

interface RoleModalProps {
  stationId: string;
  member: StationMemberWithProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({ stationId, member, isOpen, onClose }) => {
  const [selectedRole, setSelectedRole] = useState<StationRole>(member.membership.role);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedRole === member.membership.role) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await updateMemberRoleAction(stationId, member.membership.id, selectedRole);
      if (result.success) {
        onClose();
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 'var(--ys-radius-md)',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheckIcon size={20} color="var(--ys-color-brand-yellow)" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#111827' }}>
              שינוי תפקיד איש צוות
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            {member.profile.fullName || 'משתמש ללא שם'}
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>{member.profile.email}</div>
        </div>

        {error && (
          <Alert variant="danger" title="שגיאה בעדכון תפקיד">
            {error}
          </Alert>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--ys-radius-sm)',
                border:
                  selectedRole === 'ADMIN'
                    ? '1.5px solid var(--ys-color-brand-yellow)'
                    : '1px solid #E5E7EB',
                backgroundColor: selectedRole === 'ADMIN' ? '#FFFBEB' : '#F9FAFB',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="role"
                value="ADMIN"
                checked={selectedRole === 'ADMIN'}
                onChange={() => setSelectedRole('ADMIN')}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  מנהל תחנה (ADMIN)
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  גישת ניהול מלאה לתחנה, הקצאת עובדים וניהול צוות
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--ys-radius-sm)',
                border:
                  selectedRole === 'SHIFT_MANAGER'
                    ? '1.5px solid var(--ys-color-brand-crimson)'
                    : '1px solid #E5E7EB',
                backgroundColor: selectedRole === 'SHIFT_MANAGER' ? '#FEF2F2' : '#F9FAFB',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="role"
                value="SHIFT_MANAGER"
                checked={selectedRole === 'SHIFT_MANAGER'}
                onChange={() => setSelectedRole('SHIFT_MANAGER')}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  מנהל משמרת (SHIFT_MANAGER)
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  ניהול תפעולי של משמרות ועובדים במשמרת פעילה
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--ys-radius-sm)',
                border: selectedRole === 'WORKER' ? '1.5px solid #3B82F6' : '1px solid #E5E7EB',
                backgroundColor: selectedRole === 'WORKER' ? '#EFF6FF' : '#F9FAFB',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="role"
                value="WORKER"
                checked={selectedRole === 'WORKER'}
                onChange={() => setSelectedRole('WORKER')}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  עובד תחנה (WORKER)
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  עובד כללי בתחנה, משמרות ונוכחות
                </div>
              </div>
            </label>
          </div>

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}
          >
            <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={isPending}>
              ביטול
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={isPending}>
              {isPending ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Spinner size="sm" color="var(--ys-color-text-primary)" />
                  מעדכן...
                </span>
              ) : (
                'שמור תפקיד'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface StatusModalProps {
  stationId: string;
  member: StationMemberWithProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({ stationId, member, isOpen, onClose }) => {
  const [selectedStatus, setSelectedStatus] = useState<MembershipStatus>(member.membership.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedStatus === member.membership.status) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await updateMemberStatusAction(
        stationId,
        member.membership.id,
        selectedStatus
      );
      if (result.success) {
        onClose();
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 'var(--ys-radius-md)',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PowerIcon size={20} color="var(--ys-color-brand-yellow)" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: '#111827' }}>
              שינוי סטטוס חברות בתחנה
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            {member.profile.fullName || 'משתמש ללא שם'}
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>{member.profile.email}</div>
        </div>

        {error && (
          <Alert variant="danger" title="שגיאה בעדכון סטטוס">
            {error}
          </Alert>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--ys-radius-sm)',
                border: selectedStatus === 'ACTIVE' ? '1.5px solid #10B981' : '1px solid #E5E7EB',
                backgroundColor: selectedStatus === 'ACTIVE' ? '#ECFDF5' : '#F9FAFB',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="status"
                value="ACTIVE"
                checked={selectedStatus === 'ACTIVE'}
                onChange={() => setSelectedStatus('ACTIVE')}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="success" dot>
                  פעיל (ACTIVE)
                </Badge>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                  מורשה להיכנס ולעבוד בתחנה
                </span>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--ys-radius-sm)',
                border: selectedStatus === 'INACTIVE' ? '1.5px solid #9CA3AF' : '1px solid #E5E7EB',
                backgroundColor: selectedStatus === 'INACTIVE' ? '#F3F4F6' : '#F9FAFB',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="status"
                value="INACTIVE"
                checked={selectedStatus === 'INACTIVE'}
                onChange={() => setSelectedStatus('INACTIVE')}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="neutral" dot>
                  לא פעיל (INACTIVE)
                </Badge>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>חברות מושהית זמנית</span>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--ys-radius-sm)',
                border:
                  selectedStatus === 'SUSPENDED'
                    ? '1.5px solid var(--ys-color-brand-crimson)'
                    : '1px solid #E5E7EB',
                backgroundColor: selectedStatus === 'SUSPENDED' ? '#FEF2F2' : '#F9FAFB',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="status"
                value="SUSPENDED"
                checked={selectedStatus === 'SUSPENDED'}
                onChange={() => setSelectedStatus('SUSPENDED')}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="danger" dot>
                  מושעה (SUSPENDED)
                </Badge>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                  גישה חסומה בהחלטה מנהלתית
                </span>
              </div>
            </label>
          </div>

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}
          >
            <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={isPending}>
              ביטול
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={isPending}>
              {isPending ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Spinner size="sm" color="var(--ys-color-text-primary)" />
                  מעדכן...
                </span>
              ) : (
                'שמור סטטוס'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
