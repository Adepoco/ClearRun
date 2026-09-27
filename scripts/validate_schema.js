#!/usr/bin/env node
/**
 * Validates the public verdict schema and verifies the contract doc still
 * points at the schema and TypeScript mirror.
 */
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'verdict.schema.json');
const CONTRACT_PATH = path.join(ROOT, 'docs', 'CONTRACT.md');
const CORE_TYPES_PATH = path.join(ROOT, 'packages', 'core-types', 'src', 'index.ts');

function fail(message, details) {
  console.error(`FAIL validate_schema: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

if (!fs.existsSync(SCHEMA_PATH)) {
  fail(`missing schema file at ${path.relative(ROOT, SCHEMA_PATH)}`);
}

let schema;
try {
  schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (error) {
  fail('schema/verdict.schema.json is not valid JSON', String(error));
}

const ajv = new Ajv2020({ allErrors: true, strict: false, validateSchema: true });
addFormats(ajv);

if (!ajv.validateSchema(schema)) {
  fail(
    'schema/verdict.schema.json is not a valid JSON Schema',
    ajv.errorsText(ajv.errors, { separator: '\n' })
  );
}

if (fs.existsSync(CONTRACT_PATH)) {
  const contractText = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const requiredReferences = ['schema/verdict.schema.json', '@clearrun/core-types'];
  const missingReferences = requiredReferences.filter((reference) => !contractText.includes(reference));

  if (missingReferences.length > 0) {
    fail(
      'docs/CONTRACT.md is missing expected public contract references',
      missingReferences.map((reference) => `- ${reference}`).join('\n')
    );
  }
}

if (!fs.existsSync(CORE_TYPES_PATH)) {
  fail(`missing TypeScript mirror at ${path.relative(ROOT, CORE_TYPES_PATH)}`);
}

const coreTypesText = fs.readFileSync(CORE_TYPES_PATH, 'utf8');
const schemaVersionMatch = coreTypesText.match(/VERDICT_SCHEMA_VERSION\s*=\s*'([^']+)'/);

if (!schemaVersionMatch) {
  fail('packages/core-types/src/index.ts does not declare VERDICT_SCHEMA_VERSION');
}

if (typeof schema.properties?.schemaVersion !== 'object') {
  fail('schema/verdict.schema.json is missing the schemaVersion property definition');
}

console.log('PASS validate_schema: schema/verdict.schema.json is a valid JSON Schema');
if (fs.existsSync(CONTRACT_PATH)) {
  console.log('PASS validate_schema: docs/CONTRACT.md references the schema and TypeScript mirror');
}
console.log(
  `PASS validate_schema: packages/core-types/src/index.ts declares VERDICT_SCHEMA_VERSION=${schemaVersionMatch[1]}`
);
