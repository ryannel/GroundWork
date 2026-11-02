import type { Metadata } from 'next';

import { DesignPage } from '@/features/design';

export const metadata: Metadata = { title: 'Design' };

export default function Design() {
  return <DesignPage />;
}
