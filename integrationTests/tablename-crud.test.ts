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

  test('Fastify route GET /getAll returns records via hdbCore', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    // Seed a record through the REST API so the Fastify route's SQL query
    // (SELECT * FROM data.TableName) has something to return.
    await fetch(`${httpURL}/TableName/fastify-route-record`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ id: 'fastify-route-record', name: 'Via Fastify', tag: 'fastify' }),
    });

    // The Fastify route is loaded by the `fastifyRoutes` loader in config.yaml with
    // `path: .`, so it mounts under the component name.
    const res = await fetch(`${httpURL}/${componentName}/getAll`, {
      headers: { Authorization: auth },
    });

    strictEqual(res.status, 200, `expected Fastify /getAll to respond 200, got ${res.status}`);
    const body = await res.json();
    ok(Array.isArray(body), 'Fastify /getAll should return an array of records');
    ok(
      body.some((r: { id?: string }) => r.id === 'fastify-route-record'),
      'Fastify /getAll should include the seeded record',
    );
  });
});
