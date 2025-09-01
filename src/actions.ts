import * as core from '@actions/core'
import {configure} from './configure'
import {installHostDependencies} from './install-dependencies'
import {build as piGenBuild} from './build'
import {clonePigen} from './clone-pigen'
import {removeContainer} from './remove-container'
import {removeRunnerComponents} from './increase-runner-disk-size'
import {Cache} from './cache'
import {generateCacheKey} from './cache-key'

export async function main(): Promise<void> {
  try {
    // Need to force color output for chalk, until https://github.com/actions/runner/issues/241 is resolved.
    // See also https://github.com/chalk/supports-color/issues/106
    process.env['FORCE_COLOR'] = '2'

    const userConfig = await configure()

    const increaseRunnerDiskSize = core.getBooleanInput(
      'increase-runner-disk-size'
    )

    if (increaseRunnerDiskSize) {
      await core.group(
        'Removing runner components to increase disk build space',
        () => removeRunnerComponents()
      )
    }

    const piGenDirectory = core.getInput('pi-gen-dir')
    core.debug(`Using pi-gen directory: ${piGenDirectory}`)

    await installHostDependencies(
      core.getInput('extra-host-dependencies'),
      core.getInput('extra-host-modules'),
      piGenDirectory
    )

    if (core.getBooleanInput('enable-pigen-cache')) {
      await core.group('Searching for a cache hit to reuse', async () => {
        const cache = new Cache(generateCacheKey())
        await cache.restoreContainer()
      })
    }

    const piGenRepo = core.getInput('pi-gen-repository')
    core.debug(`Using pi-gen repository ${piGenRepo}`)

    await clonePigen(piGenRepo, piGenDirectory, core.getInput('pi-gen-version'))

    await piGenBuild(piGenDirectory, userConfig)
  } catch (error) {
    core.setFailed((error as Error)?.message ?? error)
  }
}

export async function cleanup(): Promise<void> {
  try {
    await removeContainer('pigen_work')
  } catch (error) {
    core.warning((error as Error)?.message ?? error)
  }
}

export async function saveCache(): Promise<void> {
  let groupOpened = false

  try {
    if (core.getBooleanInput('enable-pigen-cache')) {
      core.startGroup('Cache pi-gen container')
      groupOpened = true
      const cache = new Cache(generateCacheKey())
      await cache.cacheContainer()
    }
  } catch (error) {
    core.setFailed((error as Error)?.message ?? error)
  } finally {
    if (groupOpened) {
      core.endGroup
    }
  }
}
