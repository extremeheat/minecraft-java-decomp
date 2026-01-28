/* eslint-env mocha */
const fs = require('fs')
const { join } = require('path')
const lib = require('minecraft-java-decomp')
const assert = require('assert')

describe('decompile api works', () => {
  it('on client', async function () {
    const version = '1.20.3'
    await lib.decompile(version)
    const srcDir = join(__dirname, '../versions/', version, '/client/version.json')
    assert(fs.existsSync(srcDir))
  }).timeout(1000 * 60 * 10)

  it('on server', async function () {
    const version = '26.1-snapshot-5' // '24w14a'
    await lib.decompile(version, { side: 'server' })
    const srcDir = join(__dirname, '../versions/', version, '/server/version.json')
    assert(fs.existsSync(srcDir))
  }).timeout(1000 * 60 * 10)
})
