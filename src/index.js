/**
 * Modules
 */

// io
import fs from 'fs'
import {aws} from 'redux-effects-aws'

// modules
import hasha from 'hasha'
import path from 'path'
import pascalCase from 'pascal-case'

// utils
import curry from '@f/curry-once'
import defaults from '@f/defaults'
import assign from '@f/assign'
import mapKeys from '@f/map-keys'
import pick from '@f/pick'

let Lambda = curry(curry(aws)('Lambda'))

const createFunction = Lambda('createFunction')
const updateFunctionCode = Lambda('updateFunctionCode')
const updateFunctionConfiguration = Lambda('updateFunctionConfiguration')
const getFunctionConfig = Lambda('getFunctionConfiguration')
const deleteFunction = Lambda('deleteFunction')
const createAlias = Lambda('createAlias')
const updateAlias = Lambda('updateAlias')
const invokeFunction = Lambda('invoke')

const mapParams = curry(mapKeys)(keyMap)

const createDefaults = {
  handler: 'index.handler',
  runtime: 'nodejs',
  publish: true
}

function LambdaFunction (dir, config) {
  if (!(this instanceof LambdaFunction)) return new LambdaFunction(dir, config)
  this.dir = dir || process.cwd()
  this.config = defaults(defaults(config || {}, readConfig(dir)), createDefaults)
}

LambdaFunction.prototype.deploy = function * (zip) {
  let info

  try {
    info = yield this.getConfig()
  } catch (e) {
    if (e.statusCode === 404) {
      return yield this.create(zip)
    }
    throw e
  }

  if (info.CodeSha256 !== sha256(zip)) {
    yield this.update(zip)
  }

  return yield this.deployConfig()
}

LambdaFunction.prototype.deployConfig = function * () {
  let params = this.params([
    'name',
    'memory',
    'timeout',
    'description',
    'role',
    'handler'
  ])
  return yield updateFunctionConfiguration(params)
}

LambdaFunction.prototype.create = function * (zip) {
  let params = this.params([
    'name',
    'description',
    'memory',
    'timeout',
    'runtime',
    'handler',
    'role',
    'publish'
  ], {
    Code: {ZipFile: zip}
  })

  let created = yield createFunction(params)

  if (this.config.alias) {
    assign(created, yield this.alias(created.Version))
  }

  return created
}

LambdaFunction.prototype.getConfig = function * () {
  return yield getFunctionConfig(this.params(['name']))
}

LambdaFunction.prototype.update = function * (zip) {
  let params = this.params(['name', 'publish'], {
    ZipFile: zip
  })

  let updated = yield updateFunctionCode(params)

  if (this.config.alias) {
    assign(updated, yield this.alias(updated.Version))
  }

  return updated
}

LambdaFunction.prototype.delete = function * () {
  return yield deleteFunction(this.params(['name']))
}

LambdaFunction.prototype.invoke = function * (event, alias) {
  let params = this.params(['name'], {
    Payload: event,
    Qualifier: alias
  })

  let res = yield invokeFunction(params)
  if (res.FunctionError) {
    throw new Error(res.Payload)
  }
  return res.Payload
}

LambdaFunction.prototype.alias = function * (version) {
  try {
    return yield this.updateAlias(version)
  } catch (err) {
    if (err.statusCode === 404) {
      return yield this.createAlias(version)
    }
    throw err
  }
}

LambdaFunction.prototype.updateAlias = function * (version) {
  return yield updateAlias(this.params(['name', 'alias'], {
    FunctionVersion: version
  }))
}

LambdaFunction.prototype.createAlias = function * (version) {
  return yield createAlias(this.params(['name', 'alias'], {
    FunctionVersion: version
  }))
}

LambdaFunction.prototype.params = function (props, opts) {
  return assign(mapParams(pick(props, this.config)), opts || {})
}

function sha256 (zip) {
  return hasha(zip, {encoding: 'base64', algorithm: 'sha256'}).toString()
}

function keyMap (key) {
  key = ({
    name: 'functionName',
    memory: 'memorySize',
    alias: 'name'
  })[key] || key
  return pascalCase(key)
}

function readConfig (dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'function.json'), 'utf8'))
  } catch (e) {
    return {}
  }
}

export default LambdaFunction
