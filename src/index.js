const fs = require('fs')
const { join } = require('path')
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

  const vineFlower = await fetch('https://api.github.com/repos/Vineflower/vineflower/releases/latest').then(res => res.json())
  const vineFlowerLatestVersion = vineFlower.tag_name
  const vineFlowerJarPath = join(__dirname, '../tools/vineflower-' + vineFlowerLatestVersion + '.jar')
  if (!fs.existsSync(vineFlowerJarPath)) {
    const vineFlowerJarURL = vineFlower.assets.find(a => a.name.endsWith('.jar') && !a.name.includes('slim')).browser_download_url
    console.log('VineFlower:', vineFlowerJarURL)
    exec(`curl -L -o ${vineFlowerJarPath} ${vineFlowerJarURL}`, { stdio: 'inherit' })
  }

  return { specialSourceJarPath, vineFlowerJarPath }
}

function clearInternalCache () {
  const path = join(__dirname, '../versions/')
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true })
  }
}

async function decompile (version, options = {}) {
  const debug = options.quiet ? () => {} : console.debug
  const side = options.side || 'client'
  const path = options.path || join(__dirname, '../versions/' + version + '/')
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
    const { specialSourceJarPath, vineFlowerJarPath } = await updateDeps()
    specialSourceJar ||= specialSourceJarPath
    fernflowerJar ||= vineFlowerJarPath
  } catch (e) {
    console.error('Failed to update dependencies:', e)
  }
  if (!specialSourceJar || !fernflowerJar) {
    throw new Error('Failed to find remapper or decompiler jars')
  }

  const manifest = await getLatestManifest()
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
    const sideMappingsURL = versionManifest.downloads[side + '_mappings'].url
    // Download and save the [client|server].jar and [client|server]_mappings.txt to the path folder
    if (!fs.existsSync(jarPath)) exec(`curl -L -o ${jarPath} ${sideJarURL}`)
    if (!fs.existsSync(mappingsPath)) exec(`curl -L -o ${mappingsPath} ${sideMappingsURL}`)
    // Now remap the [client|server].jar to [client|server]-remapped.jar
    const remapped = await remap(fs.readFileSync(mappingsPath, 'utf-8'))

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
      '-jar', fernflowerJar,
      '-Xmx4G',
      '-Xms2G',
      '-hes=0', // hide empty super invocation deactivated (might clutter but allow following)
      '-hdc=0', // hide empty default constructor deactivated (allow to track)
      '-dgs=1', // decompile generic signatures activated (make sure we can follow types)
      '-lit=1', // output numeric literals
      '-asc=1', // encode non-ASCII characters in string and character
      '-log=WARN',
      ...extraOptions,
      remappedJarPath,
      decompiledPath
    ])
    return decompiledPath
  }
}

module.exports = { getLatestManifest, clearInternalCache, decompile }
