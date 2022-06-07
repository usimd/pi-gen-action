import * as core from '@actions/core'
import {PiGen} from '@pi-gen-action/common'

async function run(): Promise<void> {
  try {
    core.startGroup('Running pi-gen build')

    const configFile = core.getInput('config-file')
    const pigenDir = core.getInput('pi-gen-dir')
    const verbose = core.getBooleanInput('verbose-output')

    const piGen = new PiGen(pigenDir, configFile)
    await piGen.build(verbose)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  } finally {
    core.endGroup()
  }
}

run()
