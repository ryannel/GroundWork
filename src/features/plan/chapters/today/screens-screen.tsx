import { planHref } from '@/application/plan-pages';
import { screenCatalogueHeadline } from '@/application/plan-viz-screen-catalogue';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { ScreenCatalogue } from '@/features/plan/viz/screen-catalogue/screen-catalogue';

// What people see today: every screen, and the sequences between them.
export function ScreensScreen({ model, outline, page }: BodyProps) {
  return (
    <>
      <ScreenHead headline={screenCatalogueHeadline(model)} outline={outline} page={page} />
      <ScreenCatalogue base={planHref(outline)} model={model} />
    </>
  );
}
