/* Generated from canonical schemas by tools/generate-plan-types.ts. Do not edit: run npm run generate. */
export interface CitationShape {
  readonly cites?: true;
  readonly minimum?: number;
  readonly ref?: string;
  readonly props?: readonly (readonly [string, CitationShape])[];
  readonly items?: CitationShape;
  readonly choices?: readonly CitationShape[];
}
export const CITATION_SHAPES: Readonly<Record<string, CitationShape>> = {
  AuthoredCites: {
    cites: true,
    minimum: 1,
  },
  Owner: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Relationship: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  ServiceComponent: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  AppComponent: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  StoreComponent: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
      [
        'owner',
        {
          ref: 'Owner',
        },
      ],
    ],
  },
  TopicComponent: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
      [
        'owner',
        {
          ref: 'Owner',
        },
      ],
    ],
  },
  Component: {
    choices: [
      {
        ref: 'ServiceComponent',
      },
      {
        ref: 'AppComponent',
      },
      {
        ref: 'StoreComponent',
      },
      {
        ref: 'TopicComponent',
      },
    ],
  },
  SystemFile: {
    props: [
      [
        'components',
        {
          items: {
            ref: 'Component',
          },
        },
      ],
      [
        'relationships',
        {
          items: {
            ref: 'Relationship',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  DomainFile: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Library: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  External: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  LibrariesFile: {
    props: [
      [
        'libraries',
        {
          items: {
            ref: 'Library',
          },
        },
      ],
    ],
  },
  ExternalsFile: {
    props: [
      [
        'externals',
        {
          items: {
            ref: 'External',
          },
        },
      ],
    ],
  },
  Field: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
      [
        'args',
        {
          items: {
            ref: 'Field',
          },
        },
      ],
    ],
  },
  Schema: {
    props: [
      [
        'fields',
        {
          items: {
            ref: 'Field',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  RestEntry: {
    props: [
      [
        'errors',
        {
          items: {
            props: [
              [
                'cites',
                {
                  ref: 'AuthoredCites',
                },
              ],
            ],
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  RestInterface: {
    props: [
      [
        'entries',
        {
          items: {
            ref: 'RestEntry',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  GraphqlEntry: {
    props: [
      [
        'errors',
        {
          items: {
            props: [
              [
                'cites',
                {
                  ref: 'AuthoredCites',
                },
              ],
            ],
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  GraphqlInterface: {
    props: [
      [
        'entries',
        {
          items: {
            ref: 'GraphqlEntry',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  GrpcEntry: {
    props: [
      [
        'errors',
        {
          items: {
            props: [
              [
                'cites',
                {
                  ref: 'AuthoredCites',
                },
              ],
            ],
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  GrpcInterface: {
    props: [
      [
        'entries',
        {
          items: {
            ref: 'GrpcEntry',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  SdkEntry: {
    props: [
      [
        'errors',
        {
          items: {
            props: [
              [
                'cites',
                {
                  ref: 'AuthoredCites',
                },
              ],
            ],
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  SdkInterface: {
    props: [
      [
        'entries',
        {
          items: {
            ref: 'SdkEntry',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Endpoint: {
    choices: [
      {
        ref: 'RestEntry',
      },
      {
        ref: 'GraphqlEntry',
      },
      {
        ref: 'GrpcEntry',
      },
      {
        ref: 'SdkEntry',
      },
    ],
  },
  Interface: {
    choices: [
      {
        ref: 'RestInterface',
      },
      {
        ref: 'GraphqlInterface',
      },
      {
        ref: 'GrpcInterface',
      },
      {
        ref: 'SdkInterface',
      },
    ],
  },
  Message: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Subscription: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Job: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Interaction: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Operation: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  ContractsFile: {
    props: [
      [
        'interfaces',
        {
          items: {
            ref: 'Interface',
          },
        },
      ],
      [
        'messages',
        {
          items: {
            ref: 'Message',
          },
        },
      ],
      [
        'subscriptions',
        {
          items: {
            ref: 'Subscription',
          },
        },
      ],
      [
        'jobs',
        {
          items: {
            ref: 'Job',
          },
        },
      ],
      [
        'interactions',
        {
          items: {
            ref: 'Interaction',
          },
        },
      ],
      [
        'operations',
        {
          items: {
            ref: 'Operation',
          },
        },
      ],
      [
        'schemas',
        {
          items: {
            ref: 'Schema',
          },
        },
      ],
    ],
  },
  Region: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Screen: {
    props: [
      [
        'regions',
        {
          items: {
            ref: 'Region',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  ScreensFile: {
    props: [
      [
        'screens',
        {
          items: {
            ref: 'Screen',
          },
        },
      ],
    ],
  },
  Step: {
    props: [
      [
        'then',
        {
          ref: 'Steps',
        },
      ],
      [
        'else',
        {
          ref: 'Steps',
        },
      ],
      [
        'steps',
        {
          ref: 'Steps',
        },
      ],
      [
        'parallel',
        {
          items: {
            ref: 'Lane',
          },
        },
      ],
      [
        'try',
        {
          ref: 'Steps',
        },
      ],
      [
        'catch',
        {
          ref: 'Steps',
        },
      ],
      [
        'finally',
        {
          ref: 'Steps',
        },
      ],
      [
        'retry',
        {
          ref: 'Retry',
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Failure: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Handler: {
    props: [
      [
        'steps',
        {
          ref: 'Steps',
        },
      ],
      [
        'failures',
        {
          items: {
            ref: 'Failure',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  HandlersFile: {
    items: {
      ref: 'Handler',
    },
  },
  GraphFile: {
    props: [
      [
        'subgraphs',
        {
          items: {
            ref: 'Subgraph',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Subgraph: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Concept: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  DomainLanguageFile: {
    props: [
      [
        'concepts',
        {
          items: {
            ref: 'Concept',
          },
        },
      ],
    ],
  },
  FlowFile: {
    props: [
      [
        'steps',
        {
          items: {
            ref: 'FlowStep',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  FlowStep: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  JourneyFile: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  LandscapeConnection: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  LandscapeValueFlow: {
    props: [
      [
        'connections',
        {
          items: {
            ref: 'LandscapeConnection',
          },
        },
      ],
      [
        'summaries',
        {
          items: {
            ref: 'LandscapeConnection',
          },
        },
      ],
      [
        'overview',
        {
          items: {
            ref: 'LandscapeConnection',
          },
        },
      ],
    ],
  },
  LandscapeDetail: {
    props: [
      [
        'valueFlow',
        {
          ref: 'LandscapeValueFlow',
        },
      ],
    ],
  },
  NarrativeStage: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Narrative: {
    props: [
      [
        'connections',
        {
          items: {
            ref: 'LandscapeConnection',
          },
        },
      ],
      [
        'stages',
        {
          items: {
            ref: 'NarrativeStage',
          },
        },
      ],
    ],
  },
  PlanAddOp: {
    choices: [
      {
        props: [
          [
            'value',
            {
              ref: 'DomainFile',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'SystemFile',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Component',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Library',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'External',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Interface',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Endpoint',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Message',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Subscription',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Job',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Interaction',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Operation',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Schema',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Screen',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Handler',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Relationship',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'GraphFile',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Subgraph',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'FlowFile',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'JourneyFile',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'ProgrammeFile',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Concept',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Field',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Region',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              ref: 'Failure',
            },
          ],
        ],
      },
      {
        props: [
          [
            'value',
            {
              choices: [
                {
                  ref: 'Step',
                },
                {
                  ref: 'FlowStep',
                },
              ],
            },
          ],
        ],
      },
    ],
  },
  Planop: {
    choices: [
      {
        ref: 'PlanAddOp',
      },
    ],
  },
  Planchange: {
    props: [
      [
        'requires',
        {
          items: {
            ref: 'Planrequirement',
          },
        },
      ],
      [
        'ops',
        {
          items: {
            ref: 'Planop',
          },
        },
      ],
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Plandecision: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Planquestion: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Planrisk: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  Planrequirement: {
    props: [
      [
        'cites',
        {
          ref: 'AuthoredCites',
        },
      ],
    ],
  },
  WorkspaceDocumentDocument: {
    choices: [
      {
        ref: 'DomainFile',
      },
      {
        ref: 'SystemFile',
      },
      {
        ref: 'ContractsFile',
      },
      {
        ref: 'ScreensFile',
      },
      {
        ref: 'HandlersFile',
      },
      {
        ref: 'GraphFile',
      },
      {
        ref: 'DomainLanguageFile',
      },
      {
        ref: 'LibrariesFile',
      },
      {
        ref: 'ExternalsFile',
      },
      {
        ref: 'FlowFile',
      },
      {
        ref: 'JourneyFile',
      },
      {
        ref: 'LandscapeFile',
      },
      {
        ref: 'NarrativesFile',
      },
      {
        ref: 'ProgrammeFile',
      },
    ],
  },
  Steps: {
    items: {
      ref: 'Step',
    },
  },
  Retry: {
    props: [
      [
        'exhausted',
        {
          ref: 'Steps',
        },
      ],
    ],
  },
  Lane: {
    props: [
      [
        'steps',
        {
          ref: 'Steps',
        },
      ],
    ],
  },
  LandscapeFile: {
    props: [
      [
        'details',
        {
          items: {
            ref: 'LandscapeDetail',
          },
        },
      ],
    ],
  },
  NarrativesFile: {
    props: [
      [
        'stories',
        {
          items: {
            ref: 'Narrative',
          },
        },
      ],
    ],
  },
  ProgrammeFile: {
    props: [
      [
        'decisions',
        {
          items: {
            ref: 'Plandecision',
          },
        },
      ],
      [
        'questions',
        {
          items: {
            ref: 'Planquestion',
          },
        },
      ],
    ],
  },
};
