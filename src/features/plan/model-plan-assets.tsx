import type { ModelAsset } from '@/application/model-assets';
import { Callout } from '@/ui/callout';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import styles from './model-plan-assets.module.css';
import { PlanImage } from './viz/screens/plan-image';

/** File origins come from recorded assignments; uncertain ancestor origins remain visible gaps. */
export function ModelPlanAssets({ assets }: { readonly assets: readonly ModelAsset[] }) {
  return assets
    .map((asset, position) => ({
      asset,
      key: `${asset.file ?? asset.figma ?? 'asset'}:${String(position)}`,
    }))
    .map(({ asset, key }) => (
      <Stack key={key} gap={2}>
        {asset.label === null ? null : <Text weight="strong">{asset.label}</Text>}
        {asset.region === null ? null : <Text size="sm">Region: {asset.region}</Text>}
        {asset.href === null ? null : (
          <TextLink href={asset.href}>{asset.file ?? 'Design source'}</TextLink>
        )}
        {asset.figma === null || asset.figma === asset.href ? null : (
          <TextLink href={asset.figma}>Open in Figma</TextLink>
        )}
        {asset.href !== null && /\.(?:png|jpe?g|gif|webp|svg)$/u.test(asset.href) ? (
          <PlanImage
            className={styles.image}
            src={asset.href}
            alt={asset.label ?? 'Recorded screen'}
          />
        ) : null}
        {asset.gap === null ? null : (
          <Callout title="Asset location is unknown">
            {asset.gap}
            {asset.file === null ? null : <Text mono>{asset.file}</Text>}
          </Callout>
        )}
      </Stack>
    ));
}
