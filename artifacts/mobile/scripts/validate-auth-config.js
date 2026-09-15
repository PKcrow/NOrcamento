'use strict';

const REQUIRED_AUTH_ENV = 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY';

function getBuildProfile(argv = process.argv.slice(2), env = process.env) {
  return argv.includes('--production')
    ? 'production'
    : env.EAS_BUILD_PROFILE || null;
}

function validateProductionAuthConfig({
  profile,
  env = process.env,
} = {}) {
  if (profile !== 'production') {
    return;
  }

  const publishableKey = env[REQUIRED_AUTH_ENV];
  if (typeof publishableKey !== 'string' || publishableKey.trim() === '') {
    throw new Error(
      `Missing required environment variable ${REQUIRED_AUTH_ENV} for the production mobile build.`,
    );
  }
}

if (require.main === module) {
  try {
    validateProductionAuthConfig({
      profile: getBuildProfile(),
    });
  } catch (error) {
    console.error(`Build configuration error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  REQUIRED_AUTH_ENV,
  getBuildProfile,
  validateProductionAuthConfig,
};