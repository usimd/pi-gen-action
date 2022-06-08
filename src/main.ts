import * as core from '@actions/core'
import {configure} from './configure'
import {installHostDependencies} from './install-dependencies'
import {build} from './build'
import {clonePigen} from './clone-pigen'

async function run(): Promise<void> {
  try {
    const piGenDirectory = core.getInput('pi-gen-dir')
    core.debug(`Using pi-gen directory: ${piGenDirectory}`)

    const userConfig = await configure()
    await clonePigen(piGenDirectory, core.getInput('pi-gen-version'))
    await installHostDependencies()
    await build(piGenDirectory, userConfig)
  } catch (error) {
    core.setFailed(`${(error as Error)?.message ?? error}`)
  }
}

run()
