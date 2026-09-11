'use client';

import React, { useState, useTransition } from 'react';
import type { ShiftTemplate } from '@yellowshifts/types';
import {
  createShiftTemplateAction,
  updateShiftTemplateAction,
  toggleShiftTemplateStatusAction,
  deleteShiftTemplateAction,
} from '../actions/schedules';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@yellowshifts/ui';
import {
  ClockIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  PowerIcon,
  MoonIcon,
  SunIcon,
  WarningIcon,
  SuccessIcon,
  CloseIcon,
} from '@yellowshifts/icons';

interface ShiftTemplatesManagerProps {
  stationId: string;
  stationName: string;
  initialTemplates: ShiftTemplate[];
  canManage: boolean;
}

export function ShiftTemplatesManager({
  stationId,
  stationName,
  initialTemplates,
  canManage,
}: ShiftTemplatesManagerProps) {
  const [templates, setTemplates] = useState<ShiftTemplate[]>(initialTemplates);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<ShiftTemplate | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form states for modal
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [displayOrder, setDisplayOrder] = useState('0');

  const checkIsOvernight = (start: string, end: string): boolean => {
    if (!start || !end) return false;
    const [sh = 0, sm = 0] = start.split(':').map(Number);
    const [eh = 0, em = 0] = end.split(':').map(Number);
    return eh < sh || (eh === sh && em <= sm);
  };

  const isOvernight = checkIsOvernight(startTime, endTime);

  const openCreateModal = () => {
    setName('');
    setStartTime('07:00');
    setEndTime('15:00');
    setDisplayOrder(String(templates.length * 10));
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (template: ShiftTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setStartTime(template.startTime);
    setEndTime(template.endTime);
    setDisplayOrder(String(template.displayOrder));
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.append('stationId', stationId);
    formData.append('name', name);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    formData.append('displayOrder', displayOrder);

    startTransition(async () => {
      const res = await createShiftTemplateAction(null, formData);
      if (res.success && res.id) {
        setIsCreateModalOpen(false);
        setFeedbackMessage({ type: 'success', text: 'תבנית המשמרת הוקמה בהצלחה' });
        // Optimistically add or reload
        const newT: ShiftTemplate = {
          id: res.id,
          stationId,
          name: name.trim(),
          startTime,
          endTime,
          isActive: true,
          displayOrder: parseInt(displayOrder, 10) || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTemplates((prev) => [...prev, newT].sort((a, b) => a.displayOrder - b.displayOrder));
      } else {
        setFormError(res.error || 'שגיאה ביצירת תבנית');
      }
    });
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTemplate) return;
    setFormError(null);

    const formData = new FormData();
    formData.append('stationId', stationId);
    formData.append('templateId', editingTemplate.id);
    formData.append('name', name);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    formData.append('displayOrder', displayOrder);

    startTransition(async () => {
      const res = await updateShiftTemplateAction(null, formData);
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: 'תבנית המשמרת עודכנה בהצלחה' });
        setTemplates((prev) =>
          prev
            .map((t) =>
              t.id === editingTemplate.id
                ? {
                    ...t,
                    name: name.trim(),
                    startTime,
                    endTime,
                    displayOrder: parseInt(displayOrder, 10) || 0,
                    updatedAt: new Date().toISOString(),
                  }
                : t
            )
            .sort((a, b) => a.displayOrder - b.displayOrder)
        );
        setEditingTemplate(null);
      } else {
        setFormError(res.error || 'שגיאה בעדכון תבנית');
      }
    });
  };

  const handleToggleStatus = (template: ShiftTemplate) => {
    const nextStatus = !template.isActive;
    startTransition(async () => {
      const res = await toggleShiftTemplateStatusAction(stationId, template.id, nextStatus);
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: nextStatus ? 'תבנית המשמרת הופעלה' : 'תבנית המשמרת הושבתה',
        });
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? { ...t, isActive: nextStatus } : t))
        );
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || 'שגיאה בעדכון סטטוס' });
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingTemplate) return;
    startTransition(async () => {
      const res = await deleteShiftTemplateAction(stationId, deletingTemplate.id);
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: 'תבנית המשמרת נמחקה' });
        setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
        setDeletingTemplate(null);
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || 'שגיאה במחיקת תבנית' });
        setDeletingTemplate(null);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
            תבניות משמרות — {stationName}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', margin: '4px 0 0 0' }}>
            מבנה משמרות קבוע ועצמאי עבור פעילות 24/7 בתחנה
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusIcon size={18} />
            <span>הקמת תבנית חדשה</span>
          </Button>
        )}
      </div>

      {/* Historical Integrity Callout */}
      <div
        style={{
          backgroundColor: '#FEFCE8',
          border: '1px solid #FEF08A',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.875rem',
          color: '#854D0E',
        }}
      >
        <ClockIcon size={18} style={{ color: '#D97706', flexShrink: 0 }} />
        <span>
          <strong>שלמות היסטורית:</strong> שינוי, השבתה או עדכון של תבנית משמרת אינם משנים משמרות
          היסטוריות שכבר נוצרו בסידורי עבודה שבועיים קודמים.
        </span>
      </div>

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: feedbackMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: feedbackMessage.type === 'success' ? '#065F46' : '#991B1B',
            border: feedbackMessage.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedbackMessage.type === 'success' ? (
              <SuccessIcon size={18} />
            ) : (
              <WarningIcon size={18} />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <CardContent style={{ textAlign: 'center', padding: '48px 24px' }}>
            <ClockIcon size={48} style={{ color: '#9CA3AF', margin: '0 auto 16px' }} />
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '8px',
              }}
            >
              טרם הוגדרו תבניות משמרת לתחנה זו
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#6B7280',
                maxWidth: '420px',
                margin: '0 auto 20px',
              }}
            >
              תבניות משמרת מאפשרות לקבוע שעות פעילות קבועות (בוקר, ערב, לילה, תדלוק שיא) עבור סידורי
              העבודה.
            </p>
            {canManage && (
              <Button variant="primary" onClick={openCreateModal}>
                הקמת תבנית ראשונה
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {templates.map((tpl) => {
            const overnight = checkIsOvernight(tpl.startTime, tpl.endTime);

            return (
              <Card
                key={tpl.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: tpl.isActive ? '1px solid #E5E7EB' : '1px solid #F3F4F6',
                  opacity: tpl.isActive ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <CardHeader style={{ paddingBottom: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <CardTitle style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                      {tpl.name}
                    </CardTitle>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {overnight ? (
                        <Badge
                          variant="warning"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <MoonIcon size={12} />
                          <span>לילה / חוצה חצות</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="neutral"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <SunIcon size={12} />
                          <span>יום</span>
                        </Badge>
                      )}
                      <Badge variant={tpl.isActive ? 'success' : 'neutral'}>
                        {tpl.isActive ? 'פעילה' : 'מושבתת'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Time Display */}
                    <div
                      style={{
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        padding: '12px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>שעות משמרת:</span>
                      <span
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          color: 'var(--ys-color-brand-yellow)',
                        }}
                      >
                        {tpl.startTime} — {tpl.endTime}
                        {overnight && (
                          <span
                            style={{ fontSize: '0.75rem', color: '#9CA3AF', marginRight: '6px' }}
                          >
                            (ביום למחרת)
                          </span>
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        color: '#6B7280',
                      }}
                    >
                      <span>סדר תצוגה: #{tpl.displayOrder}</span>
                      <span>מזהה: {tpl.id.slice(0, 8)}</span>
                    </div>

                    {/* Action buttons */}
                    {canManage && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '8px',
                          borderTop: '1px solid #2A2A32',
                          paddingTop: '12px',
                        }}
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(tpl)}
                          disabled={isPending}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <EditIcon size={14} />
                          <span>עריכה</span>
                        </Button>

                        <Button
                          variant={tpl.isActive ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleStatus(tpl)}
                          disabled={isPending}
                          title={tpl.isActive ? 'השבת תבנית' : 'הפעל תבנית'}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <PowerIcon size={14} />
                          <span>{tpl.isActive ? 'השבתה' : 'הפעלה'}</span>
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingTemplate(tpl)}
                          disabled={isPending}
                          title="מחיקת תבנית"
                          style={{ padding: '6px 10px' }}
                        >
                          <TrashIcon size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Create Shift Template */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              direction: 'rtl',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                הקמת תבנית משמרת חדשה
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer' }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  color: '#991B1B',
                  border: '1px solid #FECACA',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  marginBottom: '16px',
                }}
              >
                {formError}
              </div>
            )}

            <form
              onSubmit={handleCreateSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  שם התבנית *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: בוקר, ערב, לילה, תדלוק שיא"
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#111827',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: '6px',
                    }}
                  >
                    שעת התחלה *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: '#111827',
                      fontSize: '0.9375rem',
                      direction: 'ltr',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: '6px',
                    }}
                  >
                    שעת סיום *
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: '#111827',
                      fontSize: '0.9375rem',
                      direction: 'ltr',
                    }}
                  />
                </div>
              </div>

              {/* Live Overnight Detector */}
              {isOvernight ? (
                <div
                  style={{
                    backgroundColor: '#FEFCE8',
                    border: '1px solid #FEF08A',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem',
                    color: '#854D0E',
                  }}
                >
                  <MoonIcon size={16} />
                  <span>משמרת לילה: שעת הסיום ביום שלמחרת (חוצה חצות)</span>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem',
                    color: '#166534',
                  }}
                >
                  <SunIcon size={16} />
                  <span>משמרת יום: מתחילה ומסתיימת באותו התאריך</span>
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  סדר תצוגה
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#111827',
                    fontSize: '0.9375rem',
                    direction: 'ltr',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  ביטול
                </Button>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? 'יוצר תבנית...' : 'הקם תבנית'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Shift Template */}
      {editingTemplate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              direction: 'rtl',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                עריכת תבנית משמרת: {editingTemplate.name}
              </h3>
              <button
                onClick={() => setEditingTemplate(null)}
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer' }}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  color: '#991B1B',
                  border: '1px solid #FECACA',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  marginBottom: '16px',
                }}
              >
                {formError}
              </div>
            )}

            <form
              onSubmit={handleEditSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  שם התבנית *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#111827',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: '6px',
                    }}
                  >
                    שעת התחלה *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: '#111827',
                      fontSize: '0.9375rem',
                      direction: 'ltr',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: '6px',
                    }}
                  >
                    שעת סיום *
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: '#111827',
                      fontSize: '0.9375rem',
                      direction: 'ltr',
                    }}
                  />
                </div>
              </div>

              {/* Live Overnight Detector */}
              {isOvernight ? (
                <div
                  style={{
                    backgroundColor: '#FEFCE8',
                    border: '1px solid #FEF08A',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem',
                    color: '#854D0E',
                  }}
                >
                  <MoonIcon size={16} />
                  <span>משמרת לילה: שעת הסיום ביום שלמחרת (חוצה חצות)</span>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem',
                    color: '#166534',
                  }}
                >
                  <SunIcon size={16} />
                  <span>משמרת יום: מתחילה ומסתיימת באותו התאריך</span>
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  סדר תצוגה
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#111827',
                    fontSize: '0.9375rem',
                    direction: 'ltr',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setEditingTemplate(null)}>
                  ביטול
                </Button>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? 'שומר שינויים...' : 'שמור שינויים'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deletingTemplate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #FECACA',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              direction: 'rtl',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: '0 0 12px 0',
                color: '#DC2626',
              }}
            >
              אישור מחיקת תבנית משמרת
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#4B5563',
                marginBottom: '16px',
                lineHeight: 1.5,
              }}
            >
              האם אתה בטוח שברצונך למחוק את התבנית{' '}
              <strong style={{ color: '#111827' }}>&quot;{deletingTemplate.name}&quot;</strong>?
              <br />
              משמרות היסטוריות שכבר שובצו על בסיס תבנית זו לא יושפעו ולא יימחקו.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setDeletingTemplate(null)}>
                ביטול
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isPending}
              >
                {isPending ? 'מוחק...' : 'אשר מחיקה'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
