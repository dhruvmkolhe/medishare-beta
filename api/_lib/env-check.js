export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const issues = [];

  if (!process.env.MONGODB_URI) {
    issues.push({ level: 'error', variable: 'MONGODB_URI', message: 'Missing MONGODB_URI connection string.' });
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret) {
    issues.push({
      level: isProduction ? 'error' : 'warn',
      variable: 'JWT_SECRET',
      message: 'Using default fallback JWT_SECRET. Must be set to a secure 32+ byte string in production.'
    });
  } else if (jwtSecret.length < 32 && isProduction) {
    issues.push({
      level: 'error',
      variable: 'JWT_SECRET',
      message: 'JWT_SECRET is shorter than 32 characters in production.'
    });
  }

  const kek = process.env.KEY_ENCRYPTION_KEY || '';
  if (!kek) {
    issues.push({
      level: isProduction ? 'error' : 'warn',
      variable: 'KEY_ENCRYPTION_KEY',
      message: 'Using default fallback KEY_ENCRYPTION_KEY for Ed25519 private key encryption.'
    });
  }

  const hasFatalErrors = issues.some(i => i.level === 'error');

  return {
    valid: !hasFatalErrors,
    environment: process.env.NODE_ENV || 'development',
    issues
  };
}

if (process.env.NODE_ENV === 'production') {
  const check = validateEnvironment();
  if (!check.valid) {
    console.error('🚨 FATAL ENVIRONMENT CONFIGURATION ERROR:');
    check.issues.filter(i => i.level === 'error').forEach(i => console.error(`  - [${i.variable}] ${i.message}`));
    if (process.env.STRICT_ENV_CHECK === 'true') {
      process.exit(1);
    }
  }
}
