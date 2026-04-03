import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettier,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal'],
        'newlines-between': 'always',
      }],
    },
  },
  { ignores: ['.next/**', 'node_modules/**'] },
];