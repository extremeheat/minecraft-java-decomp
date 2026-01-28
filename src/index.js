const fs = require('fs')
const { join, resolve } = require('path')
const cp = require('child_process')
const { convertMappingsMojang2TSRG } = require('./util')
function exec (cmd) {
  console.log('$', cmd)
  return cp.execSync(cmd, { stdio: 'inherit' })
}
function execFile (cmd, args) {
  console.log('$', cmd, args.join(' '))
  return cp.execFileSync(cmd, args, { stdio: 'inherit' })
}

async function getLatestManifest () {
  const manifest = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
  return manifest.json()
}

async function updateDeps () {
  fs.mkdirSync(join(__dirname, '../tools/'), { recursive: true })
  const specialSource = await fetch('https://repo1.maven.org/maven2/net/md-5/SpecialSource/maven-metadata.xml').then(res => res.text())
  const specialSourceLatestVersion = specialSource.match(/<latest>(.*?)<\/latest>/)[1]
  const specialSourceJarPath = join(__dirname, '../tools/SpecialSource-' + specialSourceLatestVersion + '.jar')
  if (!fs.existsSync(specialSourceJarPath)) {
    const specialSourceJarURL = `https://repo1.maven.org/maven2/net/md-5/SpecialSource/${specialSourceLatestVersion}/SpecialSource-${specialSourceLatestVersion}-shaded.jar`
    exec(`curl -L -o ${specialSourceJarPath} ${specialSourceJarURL}`)
  }

  let decompilerJarPath

  async function loadVineflower() { // eslint-disable-line
    const vineFlower = await fetch('https://api.github.com/repos/Vineflower/vineflower/releases/latest').then(res => res.json())
    const vineFlowerLatestVersion = vineFlower.tag_name
    const vineFlowerJarPath = join(__dirname, '../tools/vineflower-' + vineFlowerLatestVersion + '.jar')
    if (!fs.existsSync(vineFlowerJarPath)) {
      const vineFlowerJarURL = vineFlower.assets.find(a => a.name.endsWith('.jar') && !a.name.includes('slim')).browser_download_url
      console.log('VineFlower:', vineFlowerJarURL)
      exec(`curl -L -o ${vineFlowerJarPath} ${vineFlowerJarURL}`, { stdio: 'inherit' })
    }
    decompilerJarPath = vineFlowerJarPath
  }

  async function loadFernFlower () {
    const manifest = await fetch('https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/java/java-decompiler-engine/maven-metadata.xml').then(res => res.text())
    const ffLatestVersion = manifest.match(/<latest>(.*?)<\/latest>/)[1]
    const fernFlowerJarPath = join(__dirname, '../tools/fernflower-' + ffLatestVersion + '.jar')
    if (!fs.existsSync(fernFlowerJarPath)) {
      // https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/java/java-decompiler-engine/242.22855.74/java-decompiler-engine-242.22855.74.jar
      const fernFlowerJarURL = `https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/java/java-decompiler-engine/${ffLatestVersion}/java-decompiler-engine-${ffLatestVersion}.jar`
      console.log('FernFlower:', fernFlowerJarURL)
      exec(`curl -L -o ${fernFlowerJarPath} ${fernFlowerJarURL}`, { stdio: 'inherit' })
    }
    decompilerJarPath = fernFlowerJarPath
  }

  await loadFernFlower()

  return { specialSourceJarPath, decompilerJarPath }
}

function clearInternalCache () {
  const path = join(__dirname, '../versions/')
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true })
  }
}

async function decompile (version, options = {}) {
  const manifest = await getLatestManifest()

  // allow 'version' to be a version id or 'release' or 'snapshot'
  if (['release', 'snapshot'].includes(version)) {
    version = manifest.latest[version]
  }

  const debug = options.quiet ? () => {} : console.debug
  const side = options.side || 'client'
  const path = options.path ? resolve(options.path) : join(__dirname, '../versions/' + version + '/')
  const outDir = join(path, side)
  debug('Decompiling', version, 'to', outDir)
  if (fs.existsSync(outDir)) {
    if (options.force) {
      debug('Force option enabled, erasing existing version folder:', outDir)
      fs.rmSync(outDir, { recursive: true })
    } else if (fs.readdirSync(outDir).length) {
      debug('Version folder already exists. Please erase the folder or use the force option: ' + path)
      return outDir
    }
  }
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true })
  }

  // Remapper and decompilers
  let specialSourceJar = options.specialSourceJar
  let fernflowerJar = options.fernflowerJar
  const decompiler = options.decompiler || { type: 'fernflower', options: [] }
  try {
    const { specialSourceJarPath, decompilerJarPath } = await updateDeps()
    specialSourceJar ||= specialSourceJarPath
    fernflowerJar ||= decompilerJarPath
  } catch (e) {
    console.error('Failed to update dependencies:', e)
  }
  if (!specialSourceJar || !fernflowerJar) {
    throw new Error('Failed to find remapper or decompiler jars')
  }

  // console.log(manifest)
  const versionData = manifest.versions.find(v => v.id === version)
  if (!versionData) {
    throw new Error('Version not found in manifest: ' + version)
  }
  const versionManifest = await fetch(versionData.url).then(res => res.json())
  fs.writeFileSync(join(path, 'version.json'), JSON.stringify(versionManifest, null, 2))

  const jarPath = join(path, side + '.jar')
  const mappingsPath = join(path, side + '_mappings.txt')

  return work()

  async function work () {
    const sideJarURL = versionManifest.downloads[side].url
    const sideMappingsURL = versionManifest.downloads[side + '_mappings']?.url
    // Download and save the [client|server].jar and optionally, [client|server]_mappings.txt to the path folder
    if (!fs.existsSync(jarPath)) exec(`curl -L -o ${jarPath} ${sideJarURL}`)
    let remapped
    if (sideMappingsURL) {
      if (!fs.existsSync(mappingsPath)) exec(`curl -L -o ${mappingsPath} ${sideMappingsURL}`)
      // Now remap the [client|server].jar to [client|server]-remapped.jar
      remapped = await remap(fs.readFileSync(mappingsPath, 'utf-8'))
    } else {
      // Jar is already remaped
      remapped = jarPath
    }
    if (decompiler.type === 'fernflower') {
      return await decFernFlower(remapped, decompiler.options)
    } else {
      throw new Error('Decompiler not supported: ' + decompiler.type)
    }
  }

  async function remap (mappings) {
    const tsrg = convertMappingsMojang2TSRG(mappings)
    const tsrgPath = join(path, side + '.tsrg')
    fs.writeFileSync(tsrgPath, tsrg)
    const remappedJarPath = join(path, side + '-remapped.jar')
    execFile('java', [
      '-jar', specialSourceJar,
      '--in-jar', jarPath,
      '--out-jar', remappedJarPath,
      '--srg-in', tsrgPath,
      '--kill-lvt' // Kill local variable table
    ])
    return remappedJarPath
  }

  async function decFernFlower (remappedJarPath, extraOptions = []) {
    const decompiledPath = outDir
    fs.mkdirSync(decompiledPath, { recursive: true })
    execFile('java', [
      '-Xmx4G',
      '-Xms2G',
      '-jar', fernflowerJar,
      '-hes=0', // hide empty super invocation deactivated (might clutter but allow following)
      '-hdc=0', // hide empty default constructor deactivated (allow to track)
      '-dgs=1', // decompile generic signatures activated (make sure we can follow types)
      '-lit=1', // output numeric literals
      '-asc=1', // encode non-ASCII characters in string and character
      '-log=ERROR',
      ...extraOptions,
      remappedJarPath,
      decompiledPath
    ])
    const outData = fs.readdirSync(decompiledPath)
    if (outData.length === 1) {
      const decJar = outData[0]
      console.log('Unzipping:', decJar)
      // unzip with jar, use just jar xf jarPath with cp path set to decompiledPath
      cp.spawnSync('jar', ['xf', decJar], { cwd: decompiledPath })
    }
    console.log('Done decompiling to:', decompiledPath)
    return decompiledPath
  }
}

module.exports = { getLatestManifest, clearInternalCache, decompile }
