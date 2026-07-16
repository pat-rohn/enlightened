// @ts-check
// Flat ESLint config (ESLint 9/10 + angular-eslint 22). Replaces the legacy
// .eslintrc.json, whose `ng-cli-compat` shareable configs were removed from
// @angular-eslint years ago.
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/component-class-suffix': [
        'error',
        { suffixes: ['Page', 'Component'] },
      ],
      // This app is intentionally NgModule-based (standalone: false), uses
      // constructor injection, and opts into Eager change detection. These v22
      // style rules would demand an architectural rewrite, not fix bugs.
      '@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      '@angular-eslint/prefer-inject': 'off',
      // This codebase logs deliberately and uses `any` in a few device-facing
      // spots; keep these as warnings so lint stays actionable rather than red.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Templates use *ngIf/*ngFor. Migrating to @if/@for is a separate,
      // purely-cosmetic task; both are fully supported in Angular 22.
      '@angular-eslint/template/prefer-control-flow': 'off',
    },
  },
);
