/**
 * Verifies CRUD operations on the TableName REST API exposed by the Fastify template.
 * Uses explicit IDs for all records so GET lookups are reliable.
 */
import { suite, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// harper's `exports` map only exposes ".", so 'harper/dist/bin/harper.js' is not
// resolvable directly. Resolve the CLI from the exported main entry instead.
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, '..');
// setupHarperWithFixture copies the fixture into components/<basename(fixturePath)>,
// so Fastify routes (config.yaml `path: .`) mount under this component name.
const componentName = 'fastify-template';

function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

suite('TableName CRUD', (ctx: ContextWithHarper) => {
  before(async () => {
    await setupHarperWithFixture(ctx, fixtureDir, { harperBinPath });
  });

  after(async () => {
    await teardownHarper(ctx);
  });

  test('PUT /TableName/:id creates a record', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    const res = await fetch(`${httpURL}/TableName/test-record-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'test-record-1', name: 'Test Record', tag: 'integration' }),
    });

    ok(res.ok, `expected successful create, got HTTP ${res.status}`);
  });

  test('GET /TableName/:id returns the record', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/TableName/test-read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'test-read', name: 'Read Record', tag: 'read-test' }),
    });

    const getRes = await fetch(`${httpURL}/TableName/test-read`, {
      headers: { Authorization: auth },
    });

    strictEqual(getRes.status, 200);
    const body = await getRes.json() as { id: string; name: string; tag: string };
    strictEqual(body.name, 'Read Record');
    strictEqual(body.tag, 'read-test');
  });

  test('PUT /TableName/:id updates the record name', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/TableName/test-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'test-update', name: 'Before Update', tag: 'update-test' }),
    });

    await fetch(`${httpURL}/TableName/test-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'test-update', name: 'After Update', tag: 'update-test' }),
    });

    const getRes = await fetch(`${httpURL}/TableName/test-update`, {
      headers: { Authorization: auth },
    });
    const body = await getRes.json() as { name: string };
    strictEqual(body.name, 'After Update');
  });

  test('DELETE /TableName/:id removes the record', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/TableName/test-delete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'test-delete', name: 'Delete Me', tag: 'delete-test' }),
    });

    const deleteRes = await fetch(`${httpURL}/TableName/test-delete`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });
    ok(deleteRes.ok, `expected successful delete, got HTTP ${deleteRes.status}`);

    const getRes = await fetch(`${httpURL}/TableName/test-delete`, {
      headers: { Authorization: auth },
    });
    strictEqual(getRes.status, 404);
  });

  test('GET /TableName/:id returns 404 for a non-existent id', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    const res = await fetch(`${httpURL}/TableName/does-not-exist-99999`, {
      headers: { Authorization: auth },
    });

    strictEqual(res.status, 404);
  });

  test('GET /TableName returns an array', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/TableName/test-list`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'test-list', name: 'List Item', tag: 'list-test' }),
    });

    const res = await fetch(`${httpURL}/TableName/`, {
      headers: { Authorization: auth },
    });

    strictEqual(res.status, 200);
    const body = await res.json();
    ok(Array.isArray(body), 'GET /TableName should return an array');
  });

  test('Fastify route /getAll returns records via hdbCore', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    // Seed a record through the REST API so the Fastify route's SQL query
    // (SELECT * FROM data.TableName) has something to return.
    await fetch(`${httpURL}/TableName/fastify-route-record`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'fastify-route-record', name: 'Via Fastify', tag: 'fastify' }),
    });

    // The Fastify route is loaded by the `fastifyRoutes` loader in config.yaml.
    // With `path: .` the loader derives the mount prefix from the component name,
    // so the route lives under `/<componentName>/getAll`. Probe the candidate
    // mount paths and assert the route is reachable.
    const candidates = [
      `${httpURL}/${componentName}/getAll`,
      `${httpURL}/getAll`,
    ];

    let matched: { path: string; body: unknown } | undefined;
    const seen: Record<string, number> = {};
    for (const url of candidates) {
      const res = await fetch(url, { headers: { Authorization: auth } });
      seen[url] = res.status;
      if (res.ok) {
        matched = { path: url, body: await res.json() };
        break;
      }
    }

    ok(
      matched,
      `Fastify /getAll route should be reachable; tried ${JSON.stringify(seen)}`,
    );
    const body = matched!.body;
    ok(Array.isArray(body), `Fastify ${matched!.path} should return an array of records`);
    ok(
      (body as Array<{ id?: string }>).some((r) => r.id === 'fastify-route-record'),
      'Fastify /getAll should include the seeded record',
    );
  });
});
