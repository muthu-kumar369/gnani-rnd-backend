#!/usr/bin/env node

/**
 * Check coverage thresholds
 * Reads coverage report and verifies it meets minimum thresholds
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const THRESHOLDS = {
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80
};

try {
  // Read coverage summary
  const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
  const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));
  
  const total = coverageData.total;
  let failed = false;

  console.log('\n📊 Coverage Report:\n');

  for (const [metric, threshold] of Object.entries(THRESHOLDS)) {
    const actual = total[metric].pct;
    const status = actual >= threshold ? '✅' : '❌';
    
    console.log(`${status} ${metric.padEnd(12)}: ${actual.toFixed(2)}% (threshold: ${threshold}%)`);
    
    if (actual < threshold) {
      failed = true;
    }
  }

  console.log('\n');

  if (failed) {
    console.error('❌ Coverage thresholds not met!\n');
    process.exit(1);
  } else {
    console.log('✅ All coverage thresholds met!\n');
    process.exit(0);
  }
} catch (error) {
  console.error('Error reading coverage report:', error.message);
  console.error('Make sure to run: npm run test:coverage');
  process.exit(1);
}
