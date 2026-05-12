import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {configure} from './configure.js'
import {installHostDependencies} from './install-dependencies.js'
import {build} from './build.js'
import {clonePigen} from './clone-pigen.js'
import {removeContainer} from './remove-container.js'
import {removeRunnerComponents} from './increase-runner-disk-size.js'
import {WorkDirCache} from './work-dir-cache.js'
import {AptCache} from './apt-cache.js'
import {generateCacheKey} from './cache-key.js'

const piGenBuildStartedState = 'pi-gen-build-started'
const piGenBuildSuccessState = 'pi-gen-build-success'
const piGenShaState = 'pi-gen-sha'
const piGenReleaseState = 'pi-gen-release'

async function getPiGenSha(piGenDirectory: string): Promise<string> {
  const result = await exec.getExecOutput(
    'git',
    ['rev-parse', '--short', 'HEAD'],
    {cwd: piGenDirectory, silent: true}
  )
  return result.stdout.trim()
}

export async function piGen(): Promise<void> {
  try {
    // Need to force color output for chalk, until https://github.com/actions/runner/issues/241 is resolved.
    // See also https://github.com/chalk/supports-color/issues/106
    process.env['FORCE_COLOR'] = '2'

    const piGenDirectory = core.getInput('pi-gen-dir')
    core.debug(`Using pi-gen directory: ${piGenDirectory}`)

    const piGenRepo = core.getInput('pi-gen-repository')
    core.debug(`Using pi-gen repository ${piGenRepo}`)

    const increaseRunnerDiskSize = core.getBooleanInput(
      'increase-runner-disk-size'
    )
    core.debug(`Increase runner disk size: ${increaseRunnerDiskSize}`)

    const userConfig = await configure()

    if (increaseRunnerDiskSize) {
      await core.group(
        'Removing runner components to increase disk build space',
        () => removeRunnerComponents()
      )
    }

    await clonePigen(piGenRepo, piGenDirectory, core.getInput('pi-gen-version'))
    await installHostDependencies(
      core.getInput('extra-host-dependencies'),
      core.getInput('extra-host-modules'),
      piGenDirectory
    )

    const piGenSha = await getPiGenSha(piGenDirectory)
    core.info(`pi-gen checkout: ${piGenSha}`)
    core.saveState(piGenShaState, piGenSha)
    core.saveState(piGenReleaseState, userConfig.release)

    const cacheEnabled = core.getBooleanInput('enable-pigen-cache')
    let workDirMount: string | undefined

    if (cacheEnabled) {
      const workDirCache = new WorkDirCache(generateCacheKey())

      // Always mount the work directory so pi-gen writes it to the host
      workDirMount = workDirCache.workDirMountPath

      // Try to restore cached work directory into the mount path
      await core.group('Restoring work directory cache', async () => {
        await workDirCache.restore()
      })

      // Start APT proxy cache
      const aptCache = await core.group(
        'Setting up APT proxy cache',
        async () => {
          const apt = new AptCache(userConfig.release, piGenSha)
          await apt.restore()
          await apt.start()
          return apt
        }
      )

      if (userConfig.aptProxy) {
        core.warning(
          `User-configured apt-proxy '${userConfig.aptProxy}' is being ignored ` +
            `because 'enable-pigen-cache' is enabled. The built-in apt-cacher-ng ` +
            `cache (${aptCache.proxyUrl}) will be used instead. ` +
            `Set 'enable-pigen-cache: false' to use your own proxy.`
        )
      }

      userConfig.aptProxy = aptCache.proxyUrl
      core.info(`APT proxy configured: ${aptCache.proxyUrl}`)
    }

    core.saveState(piGenBuildStartedState, true)
    await build(piGenDirectory, userConfig, workDirMount)
    core.saveState(piGenBuildSuccessState, true)
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

export async function saveCache(): Promise<void> {
  try {
    if (!core.getState(piGenBuildSuccessState)) {
      core.info('Build did not succeed, skipping cache save')
      return
    }

    if (!core.getBooleanInput('enable-pigen-cache')) {
      return
    }

    if (core.getBooleanInput('cache-read-only')) {
      core.info('Cache is read-only, skipping cache save')
      return
    }

    await core.group('Saving work directory cache', async () => {
      const workDirCache = new WorkDirCache(generateCacheKey())
      await workDirCache.save()
    })

    await core.group('Saving APT cache', async () => {
      const piGenSha = core.getState(piGenShaState)
      const release = core.getState(piGenReleaseState)
      const aptCache = new AptCache(release, piGenSha)
      await aptCache.save()
    })
  } catch (error) {
    core.setFailed((error as Error)?.message ?? error)
  }
}

export async function run(): Promise<void> {
  if (core.getState('main-executed')) {
    await saveCache()
    await cleanup()
  } else {
    core.saveState('main-executed', true)
    await piGen()
  }
}
