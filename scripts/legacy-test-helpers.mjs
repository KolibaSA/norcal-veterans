import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../src/norcal-worker.mjs';

const keys = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pub = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
pub.kid = 'test';
export const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
export const envBase = { ACCESS_TEAM_DOMAIN: 'test-team.cloudflareaccess.com', ACCESS_AUD: 'expected-audience', OWNER_EMAIL: 'owner@example.com' };
export async function token(email, override = {}) {
  const now = Math.floor(Date.now() / 1000), header = b64({ alg: 'RS256', kid: 'test' });
  const payload = b64({ sub: email, email, iss: 'https://test-team.cloudflareaccess.com', aud: ['expected-audience'], nbf: now - 5, exp: now + 60, ...override });
  return header + '.' + payload + '.' + Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(header + '.' + payload))).toString('base64url');
}
const actualFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.equal(url, 'https://test-team.cloudflareaccess.com/cdn-cgi/access/certs');
  return Response.json({ keys: [pub] });
};
test.after(() => { globalThis.fetch = actualFetch; });

export function db(t) {
  const raw = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/legacy/', import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) raw.exec(readFileSync(new URL(name, directory), 'utf8'));
  t?.after(() => raw.close());
  return {
    raw, beforeBatch: null,
    prepare(sql) {
      let values = [];
      return { sql,
        bind(...args) { values = args; return this; },
        async first() { return raw.prepare(sql).get(...values) || null; },
        async all() { return { results: raw.prepare(sql).all(...values) }; },
        async run() {
          const statement = raw.prepare(sql);
          if (statement.columns().length) {
            const results = statement.all(...values);
            return { results, meta: { changes: /\bRETURNING\b/i.test(sql) ? results.length : 0 } };
          }
          return { results: [], meta: { changes: Number(statement.run(...values).changes) } };
        }
      };
    },
    async batch(statements) {
      if (this.beforeBatch) await this.beforeBatch(statements);
      raw.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) { raw.exec('ROLLBACK'); throw error; }
    }
  };
}

export async function req(env, path, email, method = 'GET', data, origin = 'https://site.test') {
  return worker.fetch(new Request('https://site.test' + path, {
    method, headers: { 'Cf-Access-Jwt-Assertion': await token(email), Origin: origin, 'Content-Type': 'application/json' },
    body: data !== undefined ? JSON.stringify(data) : undefined
  }), env);
}
