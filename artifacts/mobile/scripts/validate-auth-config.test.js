'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  REQUIRED_AUTH_ENV,
  getBuildProfile,
  validateProductionAuthConfig,
} = require('./validate-auth-config');

test('production validation rejects a missing Clerk publishable key', () => {
  assert.throws(
    () =>
      validateProductionAuthConfig({
        profile: 'production',
        env: {},
      }),
    (error) => {
      assert.match(error.message, new RegExp(REQUIRED_AUTH_ENV));
      assert.doesNotMatch(error.message, /pk_test_example_value/);
      return true;
    },
  );
});

test('production validation rejects a blank Clerk publishable key', () => {
  assert.throws(() =>
    validateProductionAuthConfig({
      profile: 'production',
      env: { [REQUIRED_AUTH_ENV]: '  ' },
    }),
  );
});

test('production validation accepts a configured Clerk publishable key', () => {
  assert.doesNotThrow(() =>
    validateProductionAuthConfig({
      profile: 'production',
      env: { [REQUIRED_AUTH_ENV]: 'pk_test_example_value' },
    }),
  );
});

test('the EAS production profile is selected without exposing environment values', () => {
  assert.equal(
    getBuildProfile([], { EAS_BUILD_PROFILE: 'production' }),
    'production',
  );
  assert.equal(getBuildProfile(['--production'], {}), 'production');
  assert.equal(getBuildProfile([], { EAS_BUILD_PROFILE: 'preview' }), 'preview');
});