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

    const piGen = await PiGen.getInstance(piGenDir, userConfig)

    if (!(await piGen.hasExportsConfigured())) {
      throw new Error(
        'No NOOBS/image exports are configured, check your config.'
      )
    }

    execOutput = await piGen.build(verbose)

    if (execOutput.exitCode != 0) {
      throw new Error(
        `pi-gen build failed with exit code ${execOutput.exitCode}`
      )
    }

    core.setOutput('image-path', await piGen.getLastImagePath())

    if (userConfig.enableNoobs === 'true') {
      core.setOutput('image-noobs-path', await piGen.getLastNoobsImagePath())
    }
  } catch (error) {
    throw new Error(
      `${(error as Error)?.message ?? error}\n${execOutput?.stderr
        .split('\n')
        .slice(-10)
        .join('\n')}`
    )
  } finally {
    core.endGroup()
  }
}
