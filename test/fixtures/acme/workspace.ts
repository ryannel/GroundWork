// Acme: a small synthetic shop for tests. Three domains, six systems and the people who use them.
// Domains and systems are listed in the order the store reads them back: by folder name.
import type { Component, Connection, Domain, Workspace } from '@/domain/workspace';

type Parts = Pick<Component, 'id' | 'name' | 'type'> &
  Partial<Pick<Component, 'tech' | 'does' | 'talksTo'>>;

const component = ({ id, name, type, tech, does, talksTo }: Parts): Component => ({
  id,
  name,
  type,
  tech: tech ?? null,
  does: does ?? null,
  talksTo: talksTo ?? [],
});

const api = (to: string): Connection => ({ to, via: 'api' });
const message = (to: string): Connection => ({ to, via: 'message' });
const data = (to: string): Connection => ({ to, via: 'data' });

/** A fresh copy of the Acme workspace every call. */
export function acmeWorkspace(): Workspace {
  return {
    id: 'acme',
    name: 'Acme',
    description: 'A small shop: a catalogue, a storefront and the orders between them.',
    isPrivate: false,
    teams: [
      { id: 'team:web', name: 'Web', colour: 2, channel: '#team-web' },
      { id: 'team:orders', name: 'Orders', colour: 3, channel: '#team-orders' },
      { id: 'team:catalogue', name: 'Catalogue', colour: 5, channel: null },
      { id: 'team:payments', name: 'Payments', colour: null, channel: '#team-payments' },
    ],
    actors: [
      {
        id: 'actor:customer',
        name: 'Customer',
        summary: 'Finds a product and orders it.',
        uses: ['svc:shop-web'],
        customer: true,
      },
      {
        id: 'actor:merchandiser',
        name: 'Merchandiser',
        summary: 'Puts products in the catalogue and keeps them right.',
        uses: ['svc:product-admin'],
        customer: false,
      },
      {
        id: 'actor:order-clerk',
        name: 'Order clerk',
        summary: 'Looks after orders once they are placed.',
        uses: ['svc:order-desk'],
        customer: false,
      },
      {
        id: 'actor:support-agent',
        name: 'Support agent',
        summary: null,
        uses: [],
        customer: false,
      },
    ],
    domains: [catalogue(), orders(), storefront()],
    keyJourneys: ['uj:buy', 'flow:publish-product'],
  };
}

function catalogue(): Domain {
  return {
    id: 'catalogue',
    name: 'Catalogue',
    purpose: null,
    systems: [
      {
        id: 'products',
        name: 'Products',
        purpose: 'Keeps every product and its details.',
        team: 'team:catalogue',
        repos: [{ repo: 'acme/products', path: null }],
        components: [
          component({
            id: 'svc:products',
            name: 'Products API',
            type: 'service',
            tech: 'Go',
            does: 'Serves and stores product details',
            talksTo: [data('st:products-db'), message('st:product-events')],
          }),
          component({
            id: 'svc:product-admin',
            name: 'Product admin',
            type: 'website',
            tech: 'React',
            does: 'Where staff edit products',
            talksTo: [api('svc:products')],
          }),
          component({
            id: 'st:products-db',
            name: 'products-db',
            type: 'database',
            tech: 'Postgres 16',
            does: 'Products and their details',
          }),
          component({
            id: 'st:product-events',
            name: 'product.events',
            type: 'queue',
            tech: 'Kafka',
            does: 'product.changed',
            talksTo: [message('svc:search-indexer')],
          }),
        ],
      },
      {
        id: 'search',
        name: 'Search',
        purpose: null,
        team: 'team:catalogue',
        repos: [{ repo: 'acme/search', path: null }],
        components: [
          component({
            id: 'svc:search-indexer',
            name: 'Search indexer',
            type: 'job',
            does: 'Keeps the search index up to date',
            talksTo: [data('st:search-index')],
          }),
          component({
            id: 'svc:search-api',
            name: 'Search API',
            type: 'service',
            tech: 'Go',
            does: 'Finds products by words',
            talksTo: [data('st:search-index')],
          }),
          component({
            id: 'st:search-index',
            name: 'search-index',
            type: 'database',
            tech: 'OpenSearch',
          }),
        ],
      },
    ],
  };
}

function orders(): Domain {
  return {
    id: 'orders',
    name: 'Orders',
    purpose: 'Takes an order from placed to paid.',
    systems: [
      {
        id: 'ordering',
        name: 'Ordering',
        purpose: 'Records orders and tells people about them.',
        team: 'team:orders',
        repos: [{ repo: 'acme/ordering', path: null }],
        components: [
          component({
            id: 'svc:order-api',
            name: 'Order API',
            type: 'service',
            tech: 'Kotlin',
            does: 'Records the order and announces it',
            talksTo: [data('st:orders-db'), message('st:order-events'), api('svc:payments')],
          }),
          component({
            id: 'svc:order-mailer',
            name: 'Order mailer',
            type: 'job',
            does: 'Emails the customer about their order',
          }),
          component({
            id: 'svc:order-desk',
            name: 'Order desk',
            type: 'website',
            tech: 'React',
            does: 'Where staff look after orders',
            talksTo: [api('svc:order-api')],
          }),
          component({
            id: 'st:orders-db',
            name: 'orders-db',
            type: 'database',
            tech: 'Postgres 16',
          }),
          component({
            id: 'st:order-events',
            name: 'order.events',
            type: 'queue',
            tech: 'Kafka',
            does: 'order.placed',
            talksTo: [message('svc:order-mailer')],
          }),
        ],
      },
      {
        id: 'payments',
        name: 'Payments',
        purpose: null,
        team: 'team:payments',
        repos: [{ repo: 'acme/payments', path: null }],
        components: [
          component({
            id: 'svc:payments',
            name: 'Payments',
            type: 'service',
            tech: 'Java',
            does: 'Takes payment for an order',
            talksTo: [api('svc:card-provider')],
          }),
          component({
            id: 'svc:card-provider',
            name: 'Card provider',
            type: 'external',
            does: 'Charges cards',
          }),
        ],
      },
    ],
  };
}

function storefront(): Domain {
  return {
    id: 'storefront',
    name: 'Storefront',
    purpose: 'What the customer sees and buys through.',
    systems: [
      {
        id: 'accounts',
        name: 'Accounts',
        purpose: null,
        team: 'team:web',
        repos: [{ repo: 'acme/accounts', path: null }],
        components: [
          component({
            id: 'svc:accounts',
            name: 'Accounts',
            type: 'service',
            does: 'Signs customers in',
            talksTo: [api('svc:identity-provider')],
          }),
          component({
            id: 'svc:identity-provider',
            name: 'Identity provider',
            type: 'external',
            does: 'Checks passwords',
          }),
        ],
      },
      {
        id: 'shop',
        name: 'Shop',
        purpose: 'The website the customer shops on.',
        team: 'team:web',
        repos: [{ repo: 'acme/shop', path: null }],
        components: [
          component({
            id: 'svc:shop-bff',
            name: 'Shop BFF',
            type: 'service',
            tech: 'Node',
            does: 'Gathers what each page shows',
            talksTo: [
              api('svc:search-api'),
              api('svc:products'),
              api('svc:order-api'),
              api('svc:accounts'),
              data('st:basket-cache'),
            ],
          }),
          component({
            id: 'svc:shop-web',
            name: 'Shop web',
            type: 'website',
            tech: 'Next.js',
            does: 'The pages the customer sees',
            talksTo: [api('svc:shop-bff')],
          }),
          component({
            id: 'st:basket-cache',
            name: 'basket-cache',
            type: 'database',
            tech: 'Redis',
            does: 'Baskets until checkout',
          }),
        ],
      },
    ],
  };
}
