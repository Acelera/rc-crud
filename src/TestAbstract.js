/* globals describe, it */
const { Dates } = require('af-helpers');

const assert = require('assert');

class TestAbstract {
  constructor({
    testSize = 20,
    testName,
    Controller,
    propMutable,
    propMetadata,
    transformPropUpdate = (d) => d,
    checkId = (id) => !!id,
    fakeGen = () => ({}),
    dbConnect = () => ({}),
  }) {
    this.testName = testName;
    this.Controller = Controller;
    this.testSize = testSize;
    this.propMutable = propMutable;
    this.propMetadata = propMetadata;
    this.transformPropUpdate = transformPropUpdate;
    this.fakeGen = fakeGen;
    this.checkId = checkId;

    this.crud = this.crud.bind(this);
    dbConnect();
  }

  crud() {
    try {
      const { Controller } = this;
      describe(this.testName, () => {
        // criacao
        describe('CREATE', () => {
          it('DEVE CRIAR UM REGISTRO', async () => {
            const fakeData = this.fakeGen();
            const create = await Controller.create(fakeData);
            assert.equal(this.checkId(create), true);
          });
          it('DEVE CRIAR 10 REGISTROS', async () => {
            const creates = [...Array(this.testSize)
              .keys()].map(() => Controller.create(this.fakeGen()));
            Promise.all(creates).then((ids) => {
              const invalidIds = ids.filter((id) => !this.checkId(id));
              assert.equal(invalidIds.length, 0);
            });
          });
          it('NAO DEVE CRIAR REGISTRO COM DADOS INVÁLIDOS', async () => {
            try {
              // sem a descricao que é obrigatoria
              const fakeData = this.fakeGen();
              delete fakeData.descricao;
              await Controller.create(fakeData);
            } catch ({ message }) {
              assert.notEqual(message.indexOf('validation failed'), -1);
            }
          });
        });
        // leitura
        describe('READ', () => {
          it('DEVE CONSULTAR 1 REGISTRO PELO fetch()', async () => {
            const fakeData = this.fakeGen();
            const id = await Controller.create(fakeData);
            const { nome, descricao } = await Controller.findById(id);
            assert.equal(nome, fakeData.nome);
            assert.equal(descricao, fakeData.descricao);
          });
          it('DEVE CONSULTAR 1 REGISTRO PELO find()', async () => {
            const fakeData = this.fakeGen();
            // eslint-disable-next-line no-underscore-dangle
            const _id = await Controller.create(fakeData);
            const find = await Controller.find({ _id }, {}, {
              limit: 1,
              skip: 0,
            });
            assert.equal(find[0].nome, fakeData.nome);
            assert.equal(find[0].descricao, fakeData.descricao);
          });
          it('DEVE CONSULTAR 10 REGISTROS PELO find() PAGINANDO', async () => {
            const r = await Controller.find({}, {}, {
              limit: 10,
              skip: 0,
            });
            assert.equal(r.length, 10);
          });
        });
        // atualizar
        describe('UPDATE', () => {
          it('DEVE PODER ATUALIZAR UMA PROP MUTÁVEL', async () => {
            const fakeData = this.fakeGen();
            const id = await Controller.create(fakeData);
            const propValue = this.transformPropUpdate(`${new Date().getTime()} - ATUALIZADA`);
            const modifier = { $set: { [this.propMutable]: propValue } };
            const update = await Controller.patch({ _id: id }, modifier);
            assert.equal(update.nModified, 1);

            const findById = await Controller.findById(id);
            assert.equal(findById[this.propMutable], propValue);
          });
          it('NÃO DEVE PODER ATUALIZAR UMA PROP de METADADOS', async () => {
            const fakeData = this.fakeGen();
            const id = await Controller.create(fakeData);
            const modifier = { $set: { [this.propMetadata]: new Date(1990, 2, 9) } };
            const update = await Controller.patch({ _id: id }, modifier);
            assert.equal(update.nModified, 1);

            const findById = await Controller.findById(id);
            assert.notEqual(
              Dates.formatDate(findById[this.propMetadata], 'DD/MM/YYYY-hh:mm:ss'),
              Dates.formatDate(modifier.$set[this.propMetadata], 'DD/MM/YYYY-hh:mm:ss'),
            );
          });
        });
        // excluir
        describe('DELETE', () => {
          it('DEVE EXCLUIR COM SOFT DELETE', async () => {
            const fakeData = this.fakeGen();
            // eslint-disable-next-line no-underscore-dangle
            const _id = await Controller.create(fakeData);
            const { nome, descricao } = await Controller.findById(_id);
            assert.equal(nome, fakeData.nome);
            assert.equal(descricao, fakeData.descricao);

            assert.equal(await Controller.remove(_id), true);
          });
          it('DEVE EXCLUIR COM ERASE', async () => {
            const fakeData = this.fakeGen();
            // eslint-disable-next-line no-underscore-dangle
            const _id = await Controller.create(fakeData);
            const { nome, descricao } = await Controller.findById(_id);
            assert.equal(nome, fakeData.nome);
            assert.equal(descricao, fakeData.descricao);

            const previousState = Controller.useSoftRemove;
            Controller.useSoftRemove = false;
            assert.equal(await Controller.remove({ _id }), 1);
            Controller.useSoftRemove = previousState;
          });
        });
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('testError', e);
    }
  }
}

export default TestAbstract;
