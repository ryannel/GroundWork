'use client';

import { useState, type ReactNode } from 'react';

import { ViewSwitch } from '@/features/plan/inspector/view-switch.client';

interface ThingViewsProps {
  readonly withPlan: ReactNode;
  /** The thing as it is today; null for a thing only the plan has, such as a decision. */
  readonly today: ReactNode | null;
}

// The page's today / with-this-plan switch: both views are drawn at build time, and this shows one.
export function ThingViews({ withPlan, today }: ThingViewsProps) {
  const [showToday, setShowToday] = useState(false);
  return (
    <>
      {today === null ? null : <ViewSwitch onChange={setShowToday} today={showToday} />}
      {showToday && today !== null ? today : withPlan}
    </>
  );
}
