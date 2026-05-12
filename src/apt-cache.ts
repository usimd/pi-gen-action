import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as fs from 'fs'

const APT_CACHE_DIR = '/tmp/apt-cacher-ng'
const APT_CACHE_CONTAINER = 'pi-gen-apt-cache'
const APT_CACHE_PORT = 3142

export class AptCache {
  private cacheKey: string
  private restoreKeys: string[]

  constructor(release: string, piGenSha: string) {
    const os = process.env['RUNNER_OS'] || 'Linux'
    const arch = process.env['RUNNER_ARCH'] || 'X64'
    const prefix = `pi-gen-apt-v1-${os}-${arch}-${release}`
    this.cacheKey = `${prefix}-${piGenSha}`
    this.restoreKeys = [`${prefix}-`]
  }

  get proxyUrl(): string {
    return `http://172.17.0.1:${APT_CACHE_PORT}`
  }

  async restore(): Promise<boolean> {
    if (!fs.existsSync(APT_CACHE_DIR)) {
      fs.mkdirSync(APT_CACHE_DIR, {recursive: true})
    }

    const restoredKey = await cache.restoreCache(
      [APT_CACHE_DIR],
      this.cacheKey,
      this.restoreKeys
    )

    if (restoredKey) {
      core.info(`Restored APT cache from key: ${restoredKey}`)
    } else {
      core.info('No APT cache found, starting fresh')
    }

    return restoredKey !== undefined
  }

  async start(): Promise<void> {
    const docker = await io.which('docker', true)
    const sudo = await io.which('sudo', true)

    // Stop any existing container
    await exec.exec(docker, ['rm', '-f', APT_CACHE_CONTAINER], {
      ignoreReturnCode: true,
      silent: true
    })

    // Ensure cache dir is writable by apt-cacher-ng (runs as uid 100 in container)
    await exec.exec(sudo, ['chmod', '777', APT_CACHE_DIR], {silent: true})

    core.info('Starting apt-cacher-ng container')

    const result = await exec.getExecOutput(
      docker,
      [
        'run',
        '-d',
        '--name',
        APT_CACHE_CONTAINER,
        '-p',
        `${APT_CACHE_PORT}:3142`,
        '-v',
        `${APT_CACHE_DIR}:/var/cache/apt-cacher-ng`,
        'sameersbn/apt-cacher-ng:latest'
      ],
      {silent: true, ignoreReturnCode: true}
    )

    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to start apt-cacher-ng container: ${result.stderr}`
      )
    }

    // Wait for the proxy to become available
    await this.waitForProxy()

    core.info(`APT proxy running at ${this.proxyUrl}`)
  }

  async stop(): Promise<void> {
    const docker = await io.which('docker', true)

    await exec.exec(docker, ['stop', APT_CACHE_CONTAINER], {
      ignoreReturnCode: true,
      silent: true
    })
    await exec.exec(docker, ['rm', APT_CACHE_CONTAINER], {
      ignoreReturnCode: true,
      silent: true
    })
  }

  async save(): Promise<void> {
    try {
      await this.stop()

      // Check if cache key already exists before uploading
      const existing = await cache.restoreCache(
        [APT_CACHE_DIR],
        this.cacheKey,
        [],
        {lookupOnly: true}
      )
      if (existing) {
        core.info(
          `APT cache already exists for key ${this.cacheKey}, skipping save`
        )
        return
      }

      // Log the cache directory size for debugging
      const sudo = await io.which('sudo', true)
      const duResult = await exec.getExecOutput(
        sudo,
        ['du', '-sh', APT_CACHE_DIR],
        {silent: true, ignoreReturnCode: true}
      )
      if (duResult.exitCode === 0) {
        core.info(`APT cache directory size: ${duResult.stdout.trim()}`)
      }

      const cacheId = await cache.saveCache([APT_CACHE_DIR], this.cacheKey)
      if (cacheId !== -1) {
        core.info('APT cache saved successfully')
      } else {
        core.warning(
          'APT cache save returned -1, cache may not have been saved'
        )
      }
    } catch (error) {
      // Cache save can fail if key already exists; that's fine
      core.warning(`Failed to save APT cache: ${(error as Error).message}`)
    }
  }

  private async waitForProxy(
    timeoutMs: number = 30000,
    intervalMs: number = 1000
  ): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const result = await exec.getExecOutput(
          'curl',
          ['--silent', '--fail', '--max-time', '2', this.proxyUrl],
          {silent: true, ignoreReturnCode: true}
        )
        if (result.exitCode === 0) {
          return
        }
      } catch {
        // ignore, retry
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
    core.warning(
      'apt-cacher-ng did not become ready in time, continuing without proxy verification'
    )
  }
}
