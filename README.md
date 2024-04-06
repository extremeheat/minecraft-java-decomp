# minecraft-java-decomp
[![NPM version](https://img.shields.io/npm/v/minecraft-java-decomp.svg)](http://npmjs.com/package/minecraft-java-decomp)
[![Build Status](https://github.com/extremeheat/minecraft-java-decomp/actions/workflows/ci.yml/badge.svg)](https://github.com/extremeheat/minecraft-java-decomp/actions/workflows/)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/extremeheat/minecraft-java-decomp)

`minecraft-java-decomp` provides an API and command line interface (CLI) to decompile and deobfuscate Minecraft Java Edition game versions, using Mojang mappings.

minecraft-java-decomp is similar to DecompilerMC which is written in Python. 

## Installation
```bash
npm install -g minecraft-java-decomp
```

## Usage (CLI)
```bash
npx minecraft-java-decomp --help
```

```
minecraft-java-decomp - v1.0.0
Minecraft Java Edition decompiler and deobfuscator
Options:
  --version, -v Version to download. For latest release, try "release" or "snapshot" for latest snapshot
  --side        "server" or "client"  (default: client)
  --path        Path to save the decompiled files. Defaults to an internal folder for this package.
  --force       Force download even if the version folder already exists
  --versions    Passing --versions will list all versions
  --clean       Clear the internal version cache (where versions are decompiled to if you did not specify a decompiler output path). No other actions will be taken.

Usage:
  minecraft-java-decomp --version latest      Start a server on the latest version
  minecraft-java-decomp --versions            List all avaliable versions
  minecraft-java-decomp -v 1.20.0 --download  Download v1.20
```

## Usage (API)
```javascript
const { decompile } = require('minecraft-java-decomp');
decompile('1.20.0', {
  side: 'client',
  path: './decompiled',
  force: false
})
```

See the [typescript types](src/index.d.ts) for more information on the options.