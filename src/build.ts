import * as core from '@actions/core'
import {ExecOutput} from '@actions/exec'
import {PiGen} from './pi-gen'
import {PiGenConfig} from './pi-gen-config'

export async function build(
  piGenDir: string,
  userConfig: PiGenConfig
): Promise<void> {
  let execOutput: ExecOutput | undefined
  try {
    core.startGroup('Running pi-gen build')

    const verbose = core.getBooleanInput('verbose-output')

    const piGen = new PiGen(piGenDir, userConfig)
    execOutput = await piGen.build(verbose)

    core.setOutput('image-path', await piGen.getLastImagePath())
  } catch (error) {
    throw new Error(
      execOutput?.stderr.split('\n').slice(-10).join('\n') ??
        (error as Error)?.message ??
        error
    )
  } finally {
    core.endGroup()
  }
}
