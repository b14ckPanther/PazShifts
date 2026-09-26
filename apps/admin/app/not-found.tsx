import React from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { PlatformAdminIcon, ArrowRightIcon } from '@yellowshifts/icons';

export default function AdminNotFound() {
  return (
    <main className="admin-page admin-page-message">
      <section className="ys-card admin-message-card" aria-labelledby="admin-404-title">
        <span className="admin-message-icon" aria-hidden="true">
          <PlatformAdminIcon size={24} />
        </span>
        <h1 id="admin-404-title">404 — דף ניהול לא נמצא</h1>
        <p>דף הניהול או התחנה המבוקשת אינם קיימים במערכת.</p>
        <div className="ys-form-actions">
          <Link href="/" className="ys-button ys-button--primary">
            <ArrowRightIcon size={18} aria-hidden="true" />
            חזרה לדשבורד הראשי
          </Link>
        </div>
      </section>
    </main>
  );
}
