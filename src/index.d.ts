module "minecraft-java-decomp" {
  function decompile (version: string, options: {
    side?: 'client' | 'server',
    // Custom path to SpecialSource jar
    specialSourceJar?: string,
    // Custom path to Fernflower jar
    fernflowerJar?: string,
    // Pick the decompiler to use (currently only supports fernflower)
    decompiler?: {
      name: 'fernflower',
      options: object
    }
  })
}