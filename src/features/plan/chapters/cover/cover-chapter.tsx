import { PartScreen } from '@/features/plan/chapters/part/part-screen';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { CoverScreen } from './cover-screen';

// The cover and the page for each team: what ships and what the room is asked to do, then what it asks of you.
export function CoverChapter(props: BodyProps) {
  return props.page.screen === 'part' ? <PartScreen {...props} /> : <CoverScreen {...props} />;
}
