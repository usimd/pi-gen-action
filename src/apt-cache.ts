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

  constructor(release: string, piGenVersion: string) {
    this.cacheKey = `pi-gen-apt-${release}-${piGenVersion}-${process.env['RUNNER_OS'] || 'Linux'}`
    this.restoreKeys = [
      `pi-gen-apt-${release}-${piGenVersion}-`,
      `pi-gen-apt-${release}-`
    ]
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

    // Stop any existing container
    await exec.exec(docker, ['rm', '-f', APT_CACHE_CONTAINER], {
      ignoreReturnCode: true,
      silent: true
    })

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
      await cache.saveCache([APT_CACHE_DIR], this.cacheKey)
      core.info('APT cache saved successfully')
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
