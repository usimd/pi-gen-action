import * as core from '@actions/core'
import {configure} from './configure'
import {installHostDependencies} from './install-dependencies'
import {build} from './build'
import {clonePigen} from './clone-pigen'

async function run(): Promise<void> {
  try {
    // Need to force color output for chalk, until https://github.com/actions/runner/issues/241 is resolved.
    // See also https://github.com/chalk/supports-color/issues/106
    process.env['FORCE_COLOR'] = '2'

    const piGenDirectory = core.getInput('pi-gen-dir')
    core.debug(`Using pi-gen directory: ${piGenDirectory}`)

    const userConfig = await configure()
    await clonePigen(piGenDirectory, core.getInput('pi-gen-version'))
    await installHostDependencies(
      core.getInput('extra-host-dependencies'),
      core.getInput('extra-host-modules')
    )
    await build(piGenDirectory, userConfig)
  } catch (error) {
    core.setFailed(`${(error as Error)?.message ?? error}`)
  }
}

run()
