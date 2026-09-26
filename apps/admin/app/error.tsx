'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Button } from '@yellowshifts/ui';
import { DangerIcon, RefreshIcon, ArrowRightIcon } from '@yellowshifts/icons';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error }: ErrorProps) {
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    console.error('Admin Application Error', { digest: error.digest || 'client-error' });
  }, [error]);

  return (
    <main className="admin-page admin-page-message">
      <section className="ys-card admin-message-card" aria-labelledby="admin-error-title">
        <span className="admin-message-icon is-danger" aria-hidden="true">
          <DangerIcon size={24} />
        </span>
        <h1 id="admin-error-title">שגיאת ניהול מערכת</h1>
        <p>אירעה שגיאה בעיבוד הנתונים הניהוליים של התחנה.</p>
        <Alert variant="danger">לא הצלחנו לטעון את העמוד. נסו שוב, או חזרו למסך הראשי.</Alert>
        {error.digest && (
          <p className="admin-message-digest">
            קוד לפנייה לתמיכה: <bdi>{error.digest}</bdi>
          </p>
        )}
        <div className="ys-form-actions">
          <Button
            variant="primary"
            isLoading={retrying}
            rightIcon={<RefreshIcon size={18} />}
            onClick={() => {
              setRetrying(true);
              window.location.reload();
            }}
          >
            נסה שנית
          </Button>
          <a href="/" className="ys-button ys-button--secondary">
            <ArrowRightIcon size={18} aria-hidden="true" />
            חזרה למסך הראשי
          </a>
        </div>
      </section>
    </main>
  );
}
