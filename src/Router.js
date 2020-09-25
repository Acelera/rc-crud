import aqp from 'api-query-params';
import autoBind from 'auto-bind';
import httpBuildQuery from 'http-build-query';

class Router {
  constructor(Controller) {
    this.controller = Controller;
    autoBind(this);
  }

  /**
   * @param query
   * @returns {{}}
   */
  static parseQuery(query) {
    const {
      filter, skip, limit, sort, projection,
    } = aqp(query);

    const resultQuery = {};

    // Filter.
    if (filter) resultQuery.filter = filter;

    // Options.
    if (skip || limit || sort || projection) {
      resultQuery.options = {};

      if (skip) resultQuery.options.skip = skip;
      if (limit) resultQuery.options.limit = limit;
      if (sort) resultQuery.options.sort = sort;
      if (projection) resultQuery.options.fields = projection;
    }

    return resultQuery;
  }

  static buildQuery(obj) {
    return httpBuildQuery(obj);
  }

  /**
   * @param stream
   * @param cb
   */
  static streamToString(stream, cb) {
    const chunks = [];
    stream.on('data', (chunk) => {
      chunks.push(chunk.toString());
    });
    stream.on('end', () => {
      cb(chunks.join(''));
    });
  }

  /**
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async get(req, res) {
    try {
      const { filter = {}, projection = {}, options = {} } = Router.parseQuery(req.query);
      const [total = 0, data = []] = [
        await this.controller.count(filter),
        await this.controller.find(filter, projection, options),
      ];
      res.status(200)
        .type('json')
        .set({
          'X-Total-Count': total,
          'X-Message': total ? `${total}-registros` : 'sem-registros',
          'X-Message-Type': 'info',
        })
        .json(data);
    } catch (e) {
      const { params: { id } } = req;
      res.status(400)
        .set({
          'X-Message': e && e.message ? e.message : `falha-atualizando-registro-put/_id=${id}`,
          'X-Message-Type': 'error',
        })
        .json({ message: e && e.message ? e.message : `falha-atualizando-registro-put/_id=${id}` });
    }
  }

  /**
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async create(req, res) {
    try {
      const { body } = req;
      // eslint-disable-next-line no-underscore-dangle
      const { _id } = await this.controller.create(body);
      res.status(_id ? 201 : 400)
        .type('json')
        .set({
          'X-Message': _id ? `registro-inserido/_id=${_id}` : 'falha-inserindo-registro',
          'X-Message-Type': _id ? 'info' : 'error',
        })
        .json({ _id });
    } catch (e) {
      res.status(400)
        .set({
          'X-Message': e && e.message ? e.message : 'falha-criando-registro',
          'X-Message-Type': 'error',
        })
        .json({ message: e && e.message ? e.message : 'falha-criando-registro' });
    }
  }

  /**
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async fetch(req, res) {
    try {
      const { params: { id }, query: { withRel } } = req;
      const data = await this.controller[withRel === 'true' ? 'findWithDependenciesbyId' : 'findById'](id);
      res.status(data ? 200 : 400)
        .type('json')
        .set({
          'X-Message': data ? `registro-carregado/_id=${id}` : `registro-nao-encontrado/_id=${id}`,
          'X-Message-Type': data ? 'info' : 'error',
          'X-Total-Count': data ? 1 : 0,
        })
        .json(data || {});
    } catch (e) {
      const { params: { id } } = req;
      res.status(400)
        .set({
          'X-Message': e && e.message ? e.message : `falha-carregando-registro/_id=${id}`,
          'X-Message-Type': 'error',
        })
        .json({ message: e && e.message ? e.message : `falha-carregando-registro/_id=${id}` });
    }
  }

  /**
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async remove(req, res) {
    try {
      const { params: { id } } = req;
      const data = await this.controller.remove(id);
      res.status(data ? 200 : 400)
        .set({
          'X-Message': data ? 'registro-removido' : 'falha-removendo-registro',
          'X-Message-Type': data ? 'info' : 'error',
        })
        .json({});
    } catch (e) {
      const { params: { id } } = req;
      res.status(400)
        .set({
          'X-Message': e && e.message ? e.message : `falha-removendo-registro-put/_id=${id}`,
          'X-Message-Type': 'error',
        })
        .json({ message: e && e.message ? e.message : `falha-removendo-registro-put/_id=${id}` });
    }
  }

  /**
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async patch(req, res) {
    try {
      const { body, params: { id } } = req;
      const data = await this.controller.patch(id, { $set: body });
      res.status(data ? 200 : 400)
        .set({
          'X-Message': data ? `registro-atualizado-patch/_id=${id}` : `falha-atualizando-registro-patch/_id=${id}`,
          'X-Message-Type': data ? 'info' : 'error',
        })
        .json(data ? {
          id,
          body,
        } : {});
    } catch (e) {
      const { params: { id } } = req;
      res.status(400)
        .set({
          'X-Message': e && e.message ? e.message : `falha-atualizando-registro-patch/_id=${id}`,
          'X-Message-Type': 'error',
        })
        .json({ message: e && e.message ? e.message : `falha-atualizando-registro-patch/_id=${id}` });
    }
  }

  /**
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async put(req, res) {
    try {
      const { body, params: { id } } = req;
      const data = await this.controller.put(id, { $set: body });
      res.status(data ? 200 : 400)
        .set({
          'X-Message': data ? `registro-atualizado-put/_id=${id}` : `falha-atualizando-registro-put/_id=${id}`,
          'X-Message-Type': data ? 'info' : 'error',
        })
        .json({ id });
    } catch (e) {
      const { params: { id } } = req;
      res.status(400)
        .set({
          'X-Message': e && e.message ? e.message : `falha-atualizando-registro-put/_id=${id}`,
          'X-Message-Type': 'error',
        })
        .json({ message: e && e.message ? e.message : `falha-atualizando-registro-put/_id=${id}` });
    }
  }
}

export default Router;
