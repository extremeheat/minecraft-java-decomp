module "minecraft-java-decomp" {
  // Decompile a Minecraft server or client jar. Returns the path to the decompiled source.
  function decompile (version: string, options: {
    side?: 'client' | 'server',
    // Path to where the decompiled source should be saved, defaults to a internal directory
    path?: string,
    // If force is specified, erase any existing decompiled source in the path before decompiling
    force?: boolean,
    // Custom path to SpecialSource jar
    specialSourceJar?: string,
    // Custom path to Fernflower jar
    fernflowerJar?: string,
    // Pick the decompiler to use (currently only supports fernflower)
    decompiler?: {
      name: 'fernflower',
      options: object
    },
    // Write less things to stdout. Note there will still be output when downloading remote files, on first decompile run.
    quiet?: boolean
  }): Promise<string>
}