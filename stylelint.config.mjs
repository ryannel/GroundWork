// Every colour, size and shadow comes from a token in src/app/globals.css.
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      { message: 'CSS module classes are camelCase.' },
    ],
    'selector-max-id': 0,
    'selector-max-compound-selectors': 3,
    'max-nesting-depth': 2,
    'declaration-no-important': true,
    'color-named': 'never',
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background',
        'background-color',
        'fill',
        'stroke',
        'font-size',
        'font-family',
        'z-index',
        'box-shadow',
        'border-radius',
        '/^(margin|padding|gap)/',
      ],
      {
        ignoreValues: [
          'inherit',
          'currentcolor',
          'transparent',
          'none',
          '0',
          'auto',
          'unset',
          'initial',
        ],
        disableFix: true,
      },
    ],
  },
  overrides: [
    {
      files: ['src/app/globals.css'],
      rules: { 'scale-unlimited/declaration-strict-value': null },
    },
  ],
};
