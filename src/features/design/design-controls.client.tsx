'use client';

import { useState } from 'react';

import { Button } from '@/ui/button';
import { FilterChips } from '@/ui/filter-chips';
import { SearchField } from '@/ui/search-field';
import { Select } from '@/ui/select';

import { Specimen } from './specimen';

type Stage = 'all' | 'draft' | 'review';
type Sort = 'recent' | 'name';

const STAGES = [
  { value: 'all', label: 'All', count: 12 },
  { value: 'draft', label: 'Draft', count: 4 },
  { value: 'review', label: 'In review', count: 8 },
] as const;

const SORTS = [
  { value: 'recent', label: 'Recently changed' },
  { value: 'name', label: 'Name' },
] as const;

// The controls that hold a value, working, so their states can be tried by hand.
export function DesignControls() {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<Stage>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [pressed, setPressed] = useState(false);
  return (
    <>
      <Specimen
        name="Button"
        use="Any action. Pick the variant by weight: primary once per view, link and quiet in rows."
      >
        <Button variant="primary">Primary</Button>
        <Button>Default</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="quiet">Quiet</Button>
        <Button size="sm">Small</Button>
        <Button
          onClick={() => {
            setPressed(!pressed);
          }}
          pressed={pressed}
        >
          Toggle
        </Button>
      </Specimen>
      <Specimen name="SearchField" use="Narrowing a long list by typing.">
        <SearchField
          label="Search plans"
          onChange={setQuery}
          placeholder="Search plans"
          value={query}
        />
      </Specimen>
      <Specimen name="Select" use="Choosing one of many, such as a domain or a sort order.">
        <Select label="Sort" onChange={setSort} options={SORTS} value={sort} />
      </Specimen>
      <Specimen name="FilterChips" use="Choosing one of a few, with how many each holds.">
        <FilterChips choices={STAGES} label="Stage" onChange={setStage} value={stage} />
      </Specimen>
    </>
  );
}
