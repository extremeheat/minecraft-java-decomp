/* eslint-env mocha */
const fs = require('fs')
const { join } = require('path')
const lib = require('minecraft-java-decomp')
const assert = require('assert')

describe('decompile api works', () => {
  it('on client', async () => {
    await lib.decompile('1.20.4')
    const srcDir = join(__dirname, '../versions/1.20.4/client/version.json')
    assert(fs.existsSync(srcDir))
  })

  it('on server', async function () {
    const version = '24w14a'
    await lib.decompile(version, { side: 'server' })
    const srcDir = join(__dirname, '../versions/', version, '/server/version.json')
    assert(fs.existsSync(srcDir))
  })
})