'use strict';

const request = require('supertest');
const path = require('path');
const assert = require('assert');
const awaitEvent = require('await-event');
const fs = require('mz/fs');
const mm = require('..');
const fixtures = path.join(__dirname, 'fixtures');

describe('test/app.test.js', () => {
  afterEach(mm.restore);

  // test mm.app
  call('app');
  // test mm.cluster
  call('cluster');

  it('should alias app.agent to app._agent', function* () {
    const baseDir = path.join(fixtures, 'app');
    const app = mm.app({
      baseDir,
      customEgg: path.join(__dirname, '../node_modules/egg'),
    });
    yield app.ready();
    assert(app.agent === app._agent);
  });

  it('should not use cache when app is closed', function* () {
    const baseDir = path.join(fixtures, 'app');
    const app1 = mm.app({
      baseDir,
      customEgg: path.join(__dirname, '../node_modules/egg'),
    });
    yield app1.ready();
    yield app1.close();

    const app2 = mm.app({
      baseDir,
      customEgg: path.join(__dirname, '../node_modules/egg'),
    });
    yield app2.ready();
    yield app2.close();

    assert(app1 !== app2);
  });

  it('should auto find framework when egg.framework exists on package.json', function* () {
    const baseDir = path.join(fixtures, 'yadan_app');
    const app = mm.app({
      baseDir,
    });
    yield app.ready();
    assert(app.config.foobar === 'yadan');
    yield app.close();
  });

  it('should emit error when load Application fail', done => {
    const baseDir = path.join(fixtures, 'app-fail');
    const app = mm.app({ baseDir, cache: false });
    app.once('error', err => {
      assert(/load error/.test(err.message));
      done();
    });
  });

  it('should ready error when loading Application fail', function* () {
    const baseDir = path.join(fixtures, 'app-loading-fail');
    const app = mm.app({ baseDir, cache: false });
    try {
      yield app.ready();
      assert(false, 'should not run');
    } catch (err) {
      assert(err.message === 'loading error');
    }
  });

  it('should close when agent load fail', function* () {
    const baseDir = path.join(fixtures, 'agent-fail');
    const app = mm.app({ baseDir, cache: false });
    try {
      yield awaitEvent(app, 'error');
      assert(false, 'should not run');
    } catch (err) {
      assert(err.message === 'agent load error');
    }
    yield app.close();
  });


  it('should create new instance when close fail', function* () {
    mm(process.env, 'CLOSE_THROW', 'true');
    const app1 = mm.app({
      baseDir: 'app-close-fail',
      cache: true,
    });
    yield app1.ready();
    try {
      yield app1.close();
      assert(false, 'should not run');
    } catch (err) {
      assert(err.message === 'app close error');
    }

    const app2 = mm.app({
      baseDir: 'app-close-fail',
      cache: true,
    });
    yield app2.ready();
    assert(app1 !== app2);
  });

});

function call(method) {
  let app;
  describe(`mm.${method}()`, () => {
    before(done => {
      const baseDir = path.join(fixtures, 'app');
      mm(process, 'cwd', () => baseDir);
      app = mm[method]({
        cache: false,
        coverage: false,
      });
      app.ready(done);
    });
    after(() => app.close());

    it('should work', done => {
      request(app.callback())
      .get('/')
      .expect('foo')
      .expect(200, done);
    });
  });

  describe(`mm.${method}({ baseDir, plugin=string })`, () => {
    const pluginDir = path.join(fixtures, 'fooPlugin');
    before(done => {
      mm(process, 'cwd', () => pluginDir);
      app = mm[method]({
        baseDir: path.join(__dirname, 'fixtures/apps/foo'),
        plugin: 'fooPlugin',
        cache: false,
        coverage: false,
      });
      app.ready(done);
    });
    after(() => app.close());

    it('should work', done => {
      request(app.callback())
      .get('/')
      .expect({
        fooPlugin: true,
      })
      .expect(200, done);
    });
  });

  describe(`mm.${method}({ baseDir, plugin=true })`, () => {
    const pluginDir = path.join(fixtures, 'fooPlugin');
    before(done => {
      mm(process, 'cwd', () => pluginDir);
      app = mm[method]({
        baseDir: path.join(__dirname, 'fixtures/apps/foo'),
        plugin: true,
        cache: false,
        coverage: false,
      });
      app.ready(done);
    });
    after(() => app.close());

    it('should work', done => {
      request(app.callback())
      .get('/')
      .expect({
        fooPlugin: true,
      })
      .expect(200, done);
    });
  });

  describe(`mm.${method}({ baseDir, plugins })`, () => {
    before(done => {
      app = mm[method]({
        baseDir: path.join(__dirname, 'fixtures/apps/foo'),
        plugins: {
          fooPlugin: {
            enable: true,
            path: path.join(fixtures, 'fooPlugin'),
          },
        },
        cache: false,
        coverage: false,
      });
      app.ready(done);
    });
    after(() => app.close());

    it('should work', done => {
      request(app.callback())
      .get('/')
      .expect({
        fooPlugin: true,
      })
      .expect(200, done);
    });
  });

  describe(`mm.${method}({ baseDir, customEgg=fullpath})`, () => {
    before(done => {
      app = mm[method]({
        baseDir: 'apps/barapp',
        customEgg: path.join(fixtures, 'bar'),
        cache: false,
        coverage: false,
      });
      app.ready(done);
    });
    after(() => app.close());

    it('should work', done => {
      request(app.callback())
      .get('/')
      .expect({
        foo: 'bar',
        foobar: 'bar',
      })
      .expect(200, done);
    });
  });


  describe(`mm.${method}({ baseDir, customEgg=true})`, () => {
    before(done => {
      mm(process, 'cwd', () => {
        return path.join(fixtures, 'bar');
      });
      app = mm[method]({
        baseDir: path.join(fixtures, 'apps/barapp'),
        customEgg: true,
        cache: false,
        coverage: false,
      });
      app.ready(done);
    });
    after(() => app.close());

    it('should work', done => {
      request(app.callback())
      .get('/')
      .expect({
        foo: 'bar',
        foobar: 'bar',
      })
      .expect(200, done);
    });
  });

  describe(`mm.${method}({ baseDir, cache=true })`, () => {
    let app1;
    let app2;
    before(done => {
      app1 = mm[method]({
        baseDir: 'cache',
        coverage: false,
      });
      app1.ready(done);
    });
    before(done => {
      app2 = mm[method]({
        baseDir: 'cache',
        coverage: false,
      });
      app2.ready(done);
    });
    after(function* () {
      yield app1.close();
      yield app2.close();
    });

    it('should equal', () => {
      assert(app1 === app2);
    });
  });


  describe(`mm.${method}({clean: false})`, () => {
    let app;
    after(() => app.close());

    it('keep log dir', function* () {
      app = mm[method]({ baseDir: 'apps/app-not-clean', clean: false });
      yield app.ready();
      assert(yield fs.exists(path.join(__dirname, 'fixtures/apps/app-not-clean/logs/keep')));
    });
  });

}
