#!/usr/bin/env node
const lib = require('./index')
const { version } = require('../package.json')
const opt = require('basic-args')({
  name: 'minecraft-java-decomp',
  description: 'Minecraft Java Edition decompiler and deobfuscator',
  version,
  options: {
    version: { type: String, description: 'Version to download. For latest release, try "release" or "snapshot" for latest snapshot', alias: 'v' },
    side: { type: String, description: '"server" or "client"', default: 'client' },
    path: { type: String, description: 'Path to save the decompiled files. Defaults to an internal folder for this package.', default: null },

    force: { type: Boolean, description: 'Force download even if the version folder already exists' },

    versions: { type: Boolean, description: 'Passing --versions will list all versions' },
    clean: { type: Boolean, description: 'Clear the internal version cache (where versions are decompiled to if you did not specify a decompiler output path). No other actions will be taken.' }
  },
  examples: [
    'minecraft-java-decomp --version latest      Start a server on the latest version',
    'minecraft-java-decomp --versions            List all avaliable versions',
    'minecraft-java-decomp -v 1.20.0 --download  Download v1.20'
  ],
  preprocess (options) {
    if (options.versions || options.clean) {
      options.version = '*'
    }
  }
})

if (opt.clean) {
  lib.clearInternalCache()
} else if (opt.versions) {
  lib.getLatestManifest().then((manifest) => {
    const latest = manifest.versions[0]
    console.log('Latest release:', manifest.latest.release, '- Latest snapshot:', manifest.latest.snapshot, '- Last update:', latest.releaseTime, 'UTC')
    console.log('Available versions:', manifest.versions.map(v => v.id).join(', '))
  })
} else {
  lib.decompile(opt.version, { side: opt.side, path: opt.path, force: opt.force })
}
