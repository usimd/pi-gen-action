import * as core from '@actions/core'
import {PiGen} from './pi-gen'
import {PiGenConfig} from './pi-gen-config'

export async function build(
  piGenDir: string,
  userConfig: PiGenConfig
): Promise<void> {
  try {
    core.startGroup('Running pi-gen build')

    const verbose = core.getBooleanInput('verbose-output')

    const piGen = new PiGen(piGenDir, userConfig)
    await piGen.build(verbose)
  } finally {
    core.endGroup()
  }
}
