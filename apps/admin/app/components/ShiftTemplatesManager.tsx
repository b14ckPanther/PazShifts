'use client';

import React, { useId, useState, useTransition } from 'react';
import type { ShiftTemplate } from '@yellowshifts/types';
import {
  createShiftTemplateAction,
  updateShiftTemplateAction,
  toggleShiftTemplateStatusAction,
  deleteShiftTemplateAction,
} from '../actions/schedules';
import { Alert, Badge, Button, Card, Dialog, EmptyState, PageHeader } from '@yellowshifts/ui';
import {
  CircleCheckIcon,
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
import '../styles/admin-templates.css';

interface TemplateFormFieldsProps {
  idPrefix: string;
  name: string;
  startTime: string;
  endTime: string;
  displayOrder: string;
  isOvernight: boolean;
  namePlaceholder?: string;
  onNameChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onDisplayOrderChange: (value: string) => void;
}

/** Shared fields for the create and edit dialogs (same inputs, same order as before). */
function TemplateFormFields({
  idPrefix,
  name,
  startTime,
  endTime,
  displayOrder,
  isOvernight,
  namePlaceholder,
  onNameChange,
  onStartTimeChange,
  onEndTimeChange,
  onDisplayOrderChange,
}: TemplateFormFieldsProps) {
  return (
    <>
      <div className="ys-form-field">
        <label className="ys-label" htmlFor={`${idPrefix}-name`}>
          שם התבנית
          <span className="ys-label-required" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          required
        />
      </div>

      <div className="tpl-time-grid">
        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${idPrefix}-start`}>
            שעת התחלה
            <span className="ys-label-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id={`${idPrefix}-start`}
            className="ys-num"
            type="time"
            dir="ltr"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            required
          />
        </div>

        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${idPrefix}-end`}>
            שעת סיום
            <span className="ys-label-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id={`${idPrefix}-end`}
            className="ys-num"
            type="time"
            dir="ltr"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Live overnight detector */}
      <p
        className={`tpl-daypart-hint ${isOvernight ? 'tpl-daypart-hint--night' : 'tpl-daypart-hint--day'}`}
        aria-live="polite"
      >
        {isOvernight ? (
          <>
            <MoonIcon size={16} aria-hidden="true" />
            <span>משמרת לילה: שעת הסיום ביום שלמחרת (חוצה חצות)</span>
          </>
        ) : (
          <>
            <SunIcon size={16} aria-hidden="true" />
            <span>משמרת יום: מתחילה ומסתיימת באותו התאריך</span>
          </>
        )}
      </p>

      <div className="ys-form-field tpl-order-field">
        <label className="ys-label" htmlFor={`${idPrefix}-order`}>
          סדר תצוגה
        </label>
        <input
          id={`${idPrefix}-order`}
          className="ys-num"
          type="number"
          dir="ltr"
          inputMode="numeric"
          value={displayOrder}
          onChange={(e) => onDisplayOrderChange(e.target.value)}
        />
      </div>
    </>
  );
}

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

  const formIdBase = useId();
  const createFormId = `${formIdBase}-create`;
  const editFormId = `${formIdBase}-edit`;

  const fieldHandlers = {
    onNameChange: setName,
    onStartTimeChange: setStartTime,
    onEndTimeChange: setEndTime,
    onDisplayOrderChange: setDisplayOrder,
  };

  return (
    <div className="tpl-manager">
      <PageHeader
        title="תבניות משמרות"
        description={`הגדרת מבנה משמרות קבוע, שעות פעילות ומשמרות לילה 24/7 עבור תחנת ${stationName}`}
        actions={
          canManage ? (
            <Button variant="primary" rightIcon={<PlusIcon size={18} />} onClick={openCreateModal}>
              הקמת תבנית חדשה
            </Button>
          ) : undefined
        }
      />

      {/* Historical integrity note */}
      <Alert variant="info" role="note" icon={<ClockIcon size={20} />} className="tpl-note">
        <strong>שלמות היסטורית:</strong> שינוי, השבתה או עדכון של תבנית משמרת אינם משנים משמרות
        היסטוריות שכבר נוצרו בסידורי עבודה שבועיים קודמים.
      </Alert>

      {/* Action feedback */}
      {feedbackMessage && (
        <div
          className={`admin-feedback admin-feedback--${feedbackMessage.type}`}
          role={feedbackMessage.type === 'success' ? 'status' : 'alert'}
        >
          {feedbackMessage.type === 'success' ? (
            <SuccessIcon size={18} aria-hidden="true" />
          ) : (
            <WarningIcon size={18} aria-hidden="true" />
          )}
          <span>{feedbackMessage.text}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="סגירת ההודעה"
            onClick={() => setFeedbackMessage(null)}
          >
            <CloseIcon size={16} />
          </Button>
        </div>
      )}

      {/* Templates list */}
      {templates.length === 0 ? (
        <Card className="tpl-empty">
          <EmptyState
            icon={<ClockIcon size={26} />}
            title="טרם הוגדרו תבניות משמרת לתחנה זו"
            description="תבניות משמרת מאפשרות לקבוע שעות פעילות קבועות (בוקר, ערב, לילה, תדלוק שיא) עבור סידורי העבודה."
            action={
              canManage ? (
                <Button
                  variant="primary"
                  rightIcon={<PlusIcon size={18} />}
                  onClick={openCreateModal}
                >
                  הקמת תבנית ראשונה
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="tpl-grid" aria-label="תבניות משמרת">
          {templates.map((tpl) => {
            const overnight = checkIsOvernight(tpl.startTime, tpl.endTime);

            return (
              <li key={tpl.id} className={`tpl-card${tpl.isActive ? '' : ' is-inactive'}`}>
                <div className="tpl-card-head">
                  <h3 className="tpl-card-name">{tpl.name}</h3>
                  <div className="tpl-card-badges">
                    {overnight ? (
                      <Badge variant="info">
                        <MoonIcon size={12} aria-hidden="true" />
                        <span>לילה / חוצה חצות</span>
                      </Badge>
                    ) : (
                      <Badge variant="neutral">
                        <SunIcon size={12} aria-hidden="true" />
                        <span>יום</span>
                      </Badge>
                    )}
                    {tpl.isActive ? (
                      <Badge variant="success">
                        <CircleCheckIcon size={12} aria-hidden="true" />
                        <span>פעילה</span>
                      </Badge>
                    ) : (
                      <Badge variant="neutral">
                        <PowerIcon size={12} aria-hidden="true" />
                        <span>מושבתת</span>
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="tpl-card-time">
                  <span className="ys-visually-hidden">שעות משמרת:</span>
                  <ClockIcon size={18} aria-hidden="true" className="tpl-card-time-icon" />
                  <bdi dir="ltr" className="ys-num tpl-card-time-range">
                    {`${tpl.startTime} – ${tpl.endTime}`}
                  </bdi>
                  {overnight && <span className="tpl-card-next-day">(ביום למחרת)</span>}
                </p>

                <dl className="tpl-card-meta">
                  <div>
                    <dt>סדר תצוגה</dt>
                    <dd className="ys-num">#{tpl.displayOrder}</dd>
                  </div>
                  <div>
                    <dt>מזהה</dt>
                    <dd className="ys-num" dir="ltr">
                      {tpl.id.slice(0, 8)}
                    </dd>
                  </div>
                </dl>

                {canManage && (
                  <div className="tpl-card-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      rightIcon={<EditIcon size={16} />}
                      onClick={() => openEditModal(tpl)}
                      disabled={isPending}
                    >
                      עריכה
                    </Button>

                    <Button
                      type="button"
                      variant={tpl.isActive ? 'tertiary' : 'outline'}
                      size="sm"
                      rightIcon={<PowerIcon size={16} />}
                      onClick={() => handleToggleStatus(tpl)}
                      disabled={isPending}
                      title={tpl.isActive ? 'השבת תבנית' : 'הפעל תבנית'}
                    >
                      {tpl.isActive ? 'השבתה' : 'הפעלה'}
                    </Button>

                    <Button
                      type="button"
                      variant="destructiveOutline"
                      size="sm"
                      iconOnly
                      className="tpl-card-delete"
                      onClick={() => setDeletingTemplate(tpl)}
                      disabled={isPending}
                      title="מחיקת תבנית"
                      aria-label={`מחיקת התבנית ${tpl.name}`}
                    >
                      <TrashIcon size={16} />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Dialog: create shift template */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        dismissible={!isPending}
        title="הקמת תבנית משמרת חדשה"
        footer={
          <>
            <Button type="submit" form={createFormId} variant="primary" isLoading={isPending}>
              הקם תבנית
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              ביטול
            </Button>
          </>
        }
      >
        <form id={createFormId} onSubmit={handleCreateSubmit} className="tpl-form">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <TemplateFormFields
            idPrefix={createFormId}
            name={name}
            startTime={startTime}
            endTime={endTime}
            displayOrder={displayOrder}
            isOvernight={isOvernight}
            namePlaceholder="לדוגמה: בוקר, ערב, לילה, תדלוק שיא"
            {...fieldHandlers}
          />
        </form>
      </Dialog>

      {/* Dialog: edit shift template */}
      <Dialog
        open={editingTemplate !== null}
        onClose={() => setEditingTemplate(null)}
        dismissible={!isPending}
        title={`עריכת תבנית משמרת: ${editingTemplate?.name ?? ''}`}
        footer={
          <>
            <Button type="submit" form={editFormId} variant="primary" isLoading={isPending}>
              שמור שינויים
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingTemplate(null)}>
              ביטול
            </Button>
          </>
        }
      >
        <form id={editFormId} onSubmit={handleEditSubmit} className="tpl-form">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <TemplateFormFields
            idPrefix={editFormId}
            name={name}
            startTime={startTime}
            endTime={endTime}
            displayOrder={displayOrder}
            isOvernight={isOvernight}
            {...fieldHandlers}
          />
        </form>
      </Dialog>

      {/* Dialog: delete confirmation */}
      <Dialog
        open={deletingTemplate !== null}
        onClose={() => setDeletingTemplate(null)}
        dismissible={!isPending}
        title="אישור מחיקת תבנית משמרת"
        footer={
          <>
            <Button
              type="button"
              variant="destructive"
              rightIcon={<TrashIcon size={16} />}
              onClick={handleDeleteConfirm}
              isLoading={isPending}
            >
              אשר מחיקה
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDeletingTemplate(null)}>
              ביטול
            </Button>
          </>
        }
      >
        <p className="tpl-delete-text">
          האם אתה בטוח שברצונך למחוק את התבנית <strong>&quot;{deletingTemplate?.name}&quot;</strong>
          ?
        </p>
        <p className="tpl-delete-text">
          משמרות היסטוריות שכבר שובצו על בסיס תבנית זו לא יושפעו ולא יימחקו.
        </p>
      </Dialog>
    </div>
  );
}
