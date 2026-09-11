'use client';
import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return (
    <span className="navigation-pending" data-pending={pending} role="status">
      {pending ? 'טוענים…' : ''}
    </span>
  );
}
export function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingIndicator />
    </Link>
  );
}
