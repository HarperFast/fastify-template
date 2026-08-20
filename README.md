# Harper Application Template

This is a template for building [Harper](https://www.harperdb.io/) applications with Fastify routes. You can download this repository as a starting point for building applications with Harper. To get started, make sure you have [installed Harper](https://docs.harperdb.io/docs/install-harperdb), which can be quickly done with `npm install -g harper`. You can run your application from the directory where you downloaded the contents of this repository with:

`harper run /path/to/your-app`

(or if you enter that directory, you can run the current directory as `harper run .`).

For more information about getting started with Harper and building applications, see our getting started guide.

This template includes the [default configuration](./config.yaml), which specifies how files are handled in your application.

The [schema.graphql](./schema.graphql) is the schema definition. This is the main starting point for defining your database schema, specifying which tables you want and what attributes/fields they should have.

The [routes/index.js](./routes/index.js) provides a template for defining Fastify routes. You can add more routes to this file as needed.

## Testing

Integration tests live in [`integrationTests/`](./integrationTests) and run against a real, ephemeral Harper instance using [`@harperfast/integration-testing`](https://www.npmjs.com/package/@harperfast/integration-testing). They exercise the REST API for the `TableName` table and the Fastify `/getAll` route.

```sh
npm run test:integration
```

> On macOS/Windows, running the tests locally requires loopback address aliases (`npx harper-integration-test-setup-loopback`, needs `sudo`). On Linux (and CI) the full `127.0.0.0/8` range is available by default, so no setup is needed. The GitHub Actions workflow runs the tests on `ubuntu-latest`.
