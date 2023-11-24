import * as core from '@actions/core'
import {configure} from './configure'
import {installHostDependencies} from './install-dependencies'
import {build} from './build'
import {clonePigen} from './clone-pigen'
import {removeContainer} from './remove-container'

const piGenBuildStartedState = 'pi-gen-build-started'

export async function piGen(): Promise<void> {
  try {
    // Need to force color output for chalk, until https://github.com/actions/runner/issues/241 is resolved.
    // See also https://github.com/chalk/supports-color/issues/106
    process.env['FORCE_COLOR'] = '2'

    const piGenDirectory = core.getInput('pi-gen-dir')
    core.debug(`Using pi-gen directory: ${piGenDirectory}`)

    const piGenRepo = core.getInput('pi-gen-repository')
    core.debug(`Using pi-gen repository ${piGenRepo}`)

    const userConfig = await configure()
    await clonePigen(piGenRepo, piGenDirectory, core.getInput('pi-gen-version'))
    await installHostDependencies(
      core.getInput('extra-host-dependencies'),
      core.getInput('extra-host-modules'),
      piGenDirectory
    )

    core.saveState(piGenBuildStartedState, true)
    await build(piGenDirectory, userConfig)
  } catch (error) {
    core.setFailed((error as Error)?.message ?? error)
  }
}

export async function cleanup(): Promise<void> {
  try {
    if (core.getState(piGenBuildStartedState)) {
      await removeContainer('pigen_work')
    } else {
      core.info('No build started, nothing to clean')
    }
  } catch (error) {
    core.warning((error as Error)?.message ?? error)
  }
}

export async function run(): Promise<void> {
  if (core.getState('main-executed')) {
    await cleanup()
  } else {
    core.saveState('main-executed', true)
    await piGen()
  }
}
