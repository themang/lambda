/**
 * Imports
 */
import 'babel-polyfill'

import test from 'tape'
import Lambda from '../src'

// modules
import path from 'path'
import hasha from 'hasha'

// utils
import bind from '@f/bind-middleware'
import throws from '@f/throws'

// redux
import Flow from 'redux-flo'
import Log from 'redux-log'
import HandleActions from 'redux-handle-actions'

test('lambda should create', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})
  let zip = 'module.exports = \'foo\''

  io(lambda.create(zip)).then(function (res) {
    let action = log[0]

    let type = action.type
    let payload = action.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'createFunction')
    t.equal(payload.params.Handler, 'index.handler')
    t.equal(payload.params.FunctionName, 'code')
    t.equal(payload.params.Runtime, 'nodejs')
    t.equal(payload.params.Publish, true)
    t.equal(payload.params.Code.ZipFile, zip)

    t.equal(res.Version, 1)

    t.end()
  })

  function handler (action) {
    return {Version: 1, FunctionName: 'code'}
  }
})

test('lambda should get config', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})

  io(lambda.getConfig()).then(function (res) {
    let action = log[0]

    let type = action.type
    let payload = action.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'getFunctionConfiguration')
    t.equal(payload.params.FunctionName, 'code')

    t.equal(res.Version, 1)

    t.end()
  })

  function handler (action) {
    return {Version: 1, FunctionName: 'code'}
  }
})

test('lambda shoud update', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})
  let zip = 'module.exports = \'foo\''

  io(lambda.update(zip)).then(function (res) {
    let action = log[0]

    let type = action.type
    let payload = action.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'updateFunctionCode')
    t.equal(payload.params.Handler, undefined)
    t.equal(payload.params.FunctionName, 'code')
    t.equal(payload.params.Runtime, undefined)
    t.equal(payload.params.Publish, true)
    t.equal(payload.params.ZipFile, zip)

    t.equal(res.Version, 1)

    t.end()
  })

  function handler (action) {
    return {Version: 1, FunctionName: 'code'}
  }
})

test('lambda should delete', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})

  io(lambda.delete()).then(function (res) {
    let action = log[0]

    let type = action.type
    let payload = action.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'deleteFunction')
    t.equal(payload.params.FunctionName, 'code')

    t.ok(res)

    t.end()
  })

  function handler (action) {
    return {}
  }
})

test('lambda deploy should update', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})
  let zip = 'module.exports = \'foo\''

  io(lambda.deploy(zip)).then(function (res) {
    let action1 = log[0]

    let type = action1.type
    let payload = action1.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'getFunctionConfiguration')

    let action2 = log[1]

    t.equal(action2.type, 'AWS')
    t.equal(action2.payload.service, 'Lambda')
    t.equal(action2.payload.method, 'updateFunctionCode')

    let action3 = log[2]

    t.equal(action3.type, 'AWS')
    t.equal(action3.payload.service, 'Lambda')
    t.equal(action3.payload.method, 'updateFunctionConfiguration')

    t.equal(res.Version, 1)

    t.end()
  })

  function handler (action) {
    if (action.payload.method === 'getFunctionConfiguration') {
      return {CodeSha256: ''}
    } else {
      return {Version: 1, FunctionName: 'code'}
    }
  }
})

test('lambda deploy should create on get config fail', function (t) {
  let log = []
  let io = bind([Flow(throws), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})
  let zip = 'module.exports = \'foo\''

  io(lambda.deploy(zip)).then(function (res) {
    let action1 = log[0]

    let type = action1.type
    let payload = action1.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'getFunctionConfiguration')

    let action2 = log[1]

    t.equal(action2.type, 'AWS')
    t.equal(action2.payload.service, 'Lambda')
    t.equal(action2.payload.method, 'createFunction')

    t.equal(res.Version, 1)

    t.end()
  })

  function handler (action) {
    if (action.payload.method === 'getFunctionConfiguration') {
      var error = new Error('Not found')
      error.statusCode = 404
      return Promise.reject(error)
    } else {
      return {Version: 1, FunctionName: 'code'}
    }
  }
})

test('lambda deploy should not update if code is the same', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code'})
  let zip = 'module.exports = \'foo\''

  io(lambda.deploy(zip)).then(function (res) {
    let action1 = log[0]

    let type = action1.type
    let payload = action1.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'getFunctionConfiguration')

    let action2 = log[1]

    t.equal(action2.type, 'AWS')
    t.equal(action2.payload.service, 'Lambda')
    t.equal(action2.payload.method, 'updateFunctionConfiguration')

    t.equal(res.Version, 1)

    t.end()
  })

  function handler (action) {
    if (action.payload.method === 'getFunctionConfiguration') {
      return {CodeSha256: sha256(zip)}
    } else {
      return {Version: 1, FunctionName: 'code'}
    }
  }
})

test('lambda should read config from function.json', function (t) {
  let lambda = Lambda(path.resolve(__dirname + '/code'))
  t.deepEqual(lambda.config, {
    description: 'Cool test function.',
    handler: 'index.handler',
    memory: 256,
    name: 'test-code',
    publish: true,
    runtime: 'nodejs',
    timeout: 5
  })
  t.end()
})

test('should add alias on create given alias', function (t) {
  let log = []
  let io = bind([Flow(), Log(log), HandleActions(handler)])

  let lambda = Lambda(path.resolve(__dirname + '/code'), {name: 'code', alias: 'master'})
  let zip = 'module.exports = \'foo\''

  io(lambda.create(zip)).then(function (res) {
    let action = log[0]

    let type = action.type
    let payload = action.payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'createFunction')

    type = log[1].type
    payload = log[1].payload

    t.equal(type, 'AWS')
    t.equal(payload.service, 'Lambda')
    t.equal(payload.method, 'updateAlias')
    t.equal(payload.params.FunctionName, 'code')
    t.equal(payload.params.Name, 'master')

    t.equal(res.Version, 1)
    t.equal(res.Name, 'master')

    t.end()
  })

  function handler (action) {
    if (action.payload.method === 'createFunction') {
      return {Version: 1, FunctionName: 'code'}
    } else {
      return {Version: 1, Name: 'master'}
    }
  }
})

// test invoke

function sha256 (zip) {
  return hasha(zip, {encoding: 'base64', algorithm: 'sha256'}).toString()
}
