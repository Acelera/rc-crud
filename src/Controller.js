import { Arrays } from 'af-helpers';
import Console from 'rc-console';
import { cloneDeep, get } from 'lodash';
import autoBind from 'auto-bind';

class Controller {
  constructor (Model, rel = undefined) {
    this.Model = Model;
    this.rel = rel;
    this.useSoftRemove = false;
    autoBind(this);
  }

  /**
   * @param selector
   * @param projection
   * @param options
   * @returns {Promise<*>}
   */
  async find (selector = {}, projection = {}, options = { sort: {} }) {
    try {
      // eslint-disable-next-line no-param-reassign
      if (this.useSoftRemove && !('deleted' in selector)) selector.deleted = false;
      return this.Model.find(selector, projection, options)
        .lean();
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * @param selector
   * @param projection
   * @param options
   * @returns {Promise<Promise<*|undefined>|void|*>}
   */
  async findOne (selector = {}, projection = {}, options = { sort: {} }) {
    try {
      // eslint-disable-next-line no-param-reassign
      if (this.useSoftRemove && !('deleted' in selector)) selector.deleted = false;
      return this.Model.findOne(selector, projection, options).lean() || {};
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * @param _id
   * @returns {Promise<Promise<*|undefined>|void|*>}
   */
  async findById (_id) {
    try {
      // eslint-disable-next-line object-shorthand
      const selector = { _id: _id };
      if (this.useSoftRemove && !('deleted' in selector)) selector.deleted = false;
      return this.Model.findOne(selector)
        .lean();
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * @param _id
   * @returns {Promise<{}>}
   */
  async findWithDependenciesbyId (_id) {
    try {
      const parent = await this.findById(_id);
      if (!parent) return {};

      // Carrega os relacionamentos dinamicamente.
      const injectRel = {};
      if (this.rel) {
        const keys = Object.keys(this.rel);
        if (keys.length) {
          // eslint-disable-next-line no-plusplus
          for (let i = 0; i < keys.length; i++) {
            const prop = get(this.rel, `[${keys[i]}].findBy.prop`);
            // carrega a propriedade que é chave no relacionamento, e onde esta o valor no pai
            if (prop) {
              const findBy = {};
              findBy[prop] = _id;
              // esse await garante que vai retornar o registro completo na rota
              injectRel[keys[i]] = await this.rel[keys[i]].controller.find(findBy);
            }
          }
        }
      }

      return { ...parent, ...injectRel };
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * @param selector
   * @returns {Promise<*>}
   */
  async count (selector = {}) {
    try {
      // eslint-disable-next-line no-param-reassign
      if (this.useSoftRemove && !('deleted' in selector)) selector.deleted = false;
      return await this.Model.countDocuments(selector);
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * @param doc
   * @returns {Promise<string|*>}
   */
  async create (doc) {
    try {
      const beforeCreate = typeof this.beforeCreate === 'function' ? this.beforeCreate : (a) => a;

      const { _id } = await this.Model.create(await beforeCreate(cloneDeep(doc)));
      if (!_id) return new Promise((resolve, reject) => reject(new Error('Falha ao criar o registro')));

      // Processa Relacionamentos Automaticamente
      this.rel && (Object.keys(this.rel) || []).map(async (key) => {
        const findBy = get(this, `rel.${key}.findBy.prop`, false);
        if (!findBy) throw new Error(`Relacionamento sem findBy.prop. Key: [${key}]`);

        const controller = get(this, `rel.${key}.controller`);
        if (!controller) throw new Error(`Relacionamento sem .controller Key: [${key}]`);

        const childrenDocs = get(doc, key);
        if (!Array.isArray(childrenDocs)) return;
        await Promise.all(childrenDocs.map((childrenDoc) => {
          return controller.create({ ...childrenDoc, [findBy]: _id });
        }));
      });

      const afterCreate = typeof this.afterCreate === 'function' ? this.afterCreate : (b) => b;
      return afterCreate(_id);
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * Soft delete do registro.
   * @param selector
   * @returns deletedCount integer
   */
  async remove (selector) {
    try {
      // eslint-disable-next-line no-param-reassign
      if (typeof selector === 'string') selector = { _id: selector };

      if (this.useSoftRemove) return this.softRemove(selector);

      if (this.beforeRemove && typeof this.beforeRemove === 'function') await this.beforeRemove(selector);

      // eslint-disable-next-line object-shorthand
      const { deletedCount } = await this.Model.deleteMany(selector);
      if (deletedCount && this.rel) await this.removeRel(selector);

      if (this.afterRemove && typeof this.afterRemove === 'function') await this.afterRemove(selector);

      return deletedCount;
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * Soft delete do registro.
   * @param _id
   * @param modifier
   * @returns {Promise<*>}
   */
  async softRemove (_id, modifier = {
    deleted: true,
    deletedAt: new Date(),
  }) {
    try {
      if (this.beforeRemove && typeof this.beforeRemove === 'function') {
        await this.beforeRemove({
          _id,
          modifier,
        });
      }

      // eslint-disable-next-line object-shorthand
      const { nModified } = await this.Model.updateMany({ _id: _id }, { $set: modifier });
      if (nModified >= 1 && this.rel) this.removeRel(_id);

      if (this.afterRemove && typeof this.afterRemove === 'function') {
        await this.afterRemove({
          _id,
          modifier,
        });
      }

      return nModified;
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * Soft delete record relationships.
   * @param _id
   * @returns {Promise<void>}
   */
  async removeRel ({ _id }) {
    try {
      const keys = Object.keys(this.rel) || [];
      keys.length && keys.map(async (key) => {
        const findBy = get(this, `rel.${key}.findBy.prop`, false);
        if (!findBy) throw new Error(`Relacionamento sem findBy.prop. Key: [${key}]`);

        const controller = get(this, `rel.${key}.controller`);
        if (!controller) throw new Error(`Relacionamento sem .controller Key: [${key}]`);

        const findResult = await controller.find({ [findBy]: _id });
        await Promise.all(findResult.map(async (registryToDel) => {
          // eslint-disable-next-line no-underscore-dangle
          await controller.remove(registryToDel._id);
        }));
      });
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * Update one record.
   * @param selector
   * @param modifier
   * @param options
   * @returns {Promise<*>}
   */
  async patch (selector = {}, modifier = {}, options = {}) {
    try {
      const beforePatch = this.beforePatch ? this.beforePatch : (a) => a;

      // eslint-disable-next-line no-param-reassign
      modifier = beforePatch(modifier);

      // eslint-disable-next-line no-param-reassign
      selector = typeof (selector) === 'string' ? { _id: selector } : selector;
      // eslint-disable-next-line no-param-reassign
      modifier.$set = modifier.$set || {};
      // eslint-disable-next-line no-param-reassign
      modifier.$set.updatedAt = new Date();

      const afterPatch = this.afterPatch ? this.afterPatch : (b) => b;
      return afterPatch(this.Model.updateMany(selector, modifier, options));
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * Update mutiple records.
   * @param selector
   * @param modifier
   * @param options
   * @returns {Promise<*>}
   */
  async updateMulti (selector = {}, modifier = {}, options = {}) {
    try {
      return this.updateMany(selector, modifier, { multi: true, ...options });
    } catch (e) {
      throw new Error(e.message);
    }
  }

  /**
   * Atualiza via Substituição de um registro no db
   * @param selector
   * @param modifier
   * @param options
   * @returns {Promise<*>}
   */
  async put (selector, modifier = {}, options = {}) {
    try {
      const beforePut = this.beforePut ? this.beforePut : (a) => a;
      const original = beforePut(cloneDeep(modifier));

      // eslint-disable-next-line no-param-reassign
      modifier = beforePut(modifier);

      // eslint-disable-next-line no-param-reassign
      modifier = modifier.$set || {};

      // eslint-disable-next-line no-param-reassign
      modifier.updatedAt = new Date();

      // eslint-disable-next-line no-param-reassign
      selector = typeof selector === 'string' ? { _id: selector } : selector;

      const update = await this.Model.replaceOne(selector, modifier, {
        ...options,
        runValidators: true,
      });
      if (update && this.rel) {
        await this.putRel(selector, original);
      }

      const afterPut = this.afterPut ? this.afterPut : (b) => b;
      return afterPut(update);
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * Insere os relacionamentos
   * @param selector
   * @param doc
   * @returns {Promise<void>}
   */
  async putRel (selector, doc) {
    try {
      const keys = Object.keys(this.rel);
      // eslint-disable-next-line no-param-reassign
      selector = typeof selector === 'string' ? { _id: selector } : selector;

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < keys.length; i++) {
        const relData = get(doc, `$set[${keys[i]}]`);
        const whenPutKeep = get(this.rel, `[${keys[i]}].whenPut.keep`, false);
        const findByProp = this.rel[keys[i]].findBy.prop;
        // eslint-disable-next-line no-underscore-dangle
        const selectorRel = { [findByProp]: selector._id };

        // remove os relacionamentos previos na base antes de inserir os novos
        if (relData && this.rel[keys[i]].Model && whenPutKeep !== true) {
          // eslint-disable-next-line no-await-in-loop,max-len,no-return-await
          const promisesDel = (await this.rel[keys[i]].Model.find(selectorRel) || []).map(async ({ _id }) => await this.rel[keys[i]].Model.remove(_id));
          Promise.all(promisesDel)
            .then(() => {
              // insere os relacionamentos dependentes
              if (relData && relData.length > 0) {
                // eslint-disable-next-line max-len,no-return-await
                relData.map(async ({ _id, ...others }) => await this.rel[keys[i]].Model.create({ ...others, ...selectorRel }));
              }
            });
        }
      }
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }

  /**
   * @param operations
   * @param options
   * @param chunkSize
   * @returns {Promise<*[]>}
   */
  async bulkWrite (operations, options = { ordered: false }, chunkSize = 1000) {
    try {
      const self = this;
      const chunks = Arrays.chunk(operations, chunkSize);
      const promises = chunks.map((chunk) => self.Model.bulkWrite(chunk, options));
      return Promise.all(promises);
    } catch ({ message }) {
      Console.err(message).newLine();
      throw new Error(message);
    }
  }
}

export default Controller;
