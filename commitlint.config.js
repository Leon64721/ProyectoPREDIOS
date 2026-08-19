'use strict';

/**
 * Formaliza la convención de commits ya usada en este proyecto desde antes de
 * este archivo: `tipo(módulo): descripción [TICKET]`. Ver CONTRIBUTING.md.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'perf', 'style', 'ci'],
    ],
    'subject-case': [0], // el proyecto ya mezcla mayúsculas en nombres propios (RT, PAC, IDU)
    'header-max-length': [2, 'always', 100],
  },
};
