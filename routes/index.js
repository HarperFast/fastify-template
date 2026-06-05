const getAll = async (server, { hdbCore, logger }) => {
  server.route({
    url: '/getAll',
    method: 'GET',
    handler: async (request, reply) => {
      request.body = {
        operation: 'sql',
        sql: 'SELECT * FROM data.TableName'
      };
      return hdbCore.requestWithoutAuthentication(request);
    }
  });
}
export default getAll;
