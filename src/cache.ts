import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as fs from 'fs'
import {CacheKey} from './cache-key'

const CONTAINER_IMAGE_PATH = '/tmp/pi-gen.tar'
const CONTAINER_IMAGE_CACHE_PATH = `${CONTAINER_IMAGE_PATH}.lrz`
const CONTAINER_NAME = 'pigen_work'
const IMAGE_NAME = 'pi-gen'

export class Cache {
  constructor(private cacheKey: CacheKey) {}

  public async cacheContainer() {
    try {
      const docker = await io.which('docker', true)
      const lrzip = await io.which('lrzip', true)

      core.debug(`Found 'docker' command at ${docker}`)
      core.debug(`Found 'lrzip' command at ${lrzip}`)

      core.info('Creating image snapshot of pi-gen container')

      const dockerCommitResult = await exec.getExecOutput(
        docker,
        ['commit', CONTAINER_NAME, `${IMAGE_NAME}:latest`],
        this.execOptions()
      )

      if (dockerCommitResult.exitCode !== 0) {
        throw new Error(
          `Failed to execute 'docker commit' for pi-gen container: ${dockerCommitResult.stderr}`
        )
      }

      core.info('Saving pi-gen image to file')

      const dockerSaveResult = await exec.getExecOutput(
        docker,
        ['save', '-o', CONTAINER_IMAGE_PATH, `${IMAGE_NAME}:latest`],
        this.execOptions()
      )

      if (dockerSaveResult.exitCode !== 0) {
        throw new Error(
          `Failed to execute 'docker save' for pi-gen image: ${dockerSaveResult.stderr}`
        )
      }

      core.info('Compressing container file before uploading to cache')

      const lrzipResult = await exec.getExecOutput(
        lrzip,
        ['-v', '--level=9', CONTAINER_IMAGE_PATH],
        this.execOptions()
      )

      if (lrzipResult.exitCode !== 0) {
        throw new Error(
          `Failed to compress dumped container image using 'lrzip': ${lrzipResult.stderr}`
        )
      }

      await cache.saveCache([CONTAINER_IMAGE_CACHE_PATH], this.cacheKey.key)
    } finally {
      this.cleanTempCacheFiles()
    }
  }

  public async restoreContainer(): Promise<boolean> {
    try {
      const docker = await io.which('docker', true)
      const lrzip = await io.which('lrzip', true)

      const restoredCache = await cache.restoreCache(
        [CONTAINER_IMAGE_CACHE_PATH],
        this.cacheKey.key,
        this.cacheKey.restoreKeys,
        {segmentTimeoutInMs: 10 * 60 * 1000}
      )

      if (restoredCache === undefined) {
        return false
      }

      core.info(`Identified cache hit with key ${restoredCache}`)

      const uncompressResult = await exec.getExecOutput(
        lrzip,
        ['-v', '-d', CONTAINER_IMAGE_CACHE_PATH],
        this.execOptions()
      )

      if (uncompressResult.exitCode !== 0) {
        throw new Error(
          `Failed to uncompress cached container image file: ${uncompressResult.stderr}`
        )
      }

      const dockerLoadResult = await exec.getExecOutput(
        docker,
        ['load', '-i', CONTAINER_IMAGE_PATH],
        this.execOptions()
      )

      if (dockerLoadResult.exitCode !== 0) {
        throw new Error(
          `Failed to load cached pi-gen image to Docker daemon: ${dockerLoadResult.stderr}`
        )
      }

      // Attempt to retag whatever image was loaded to the expected image name
      // pi-gen:latest so subsequent create uses the expected repository name.
      try {
        const loadOutput = String(dockerLoadResult.stdout ?? dockerLoadResult.stderr ?? '')
        const m = /Loaded image:\s*(\S+)/.exec(loadOutput)
        if (m && m[1]) {
          const sourceImage = m[1]
          core.debug(`Retagging loaded image ${sourceImage} -> ${IMAGE_NAME}:latest`)
          const tagRes = await exec.getExecOutput(
            docker,
            ['tag', sourceImage, `${IMAGE_NAME}:latest`],
            this.execOptions()
          )
          if (tagRes.exitCode !== 0) {
            core.debug(`docker tag failed: ${tagRes.stderr}`)
          }
        } else {
          core.debug('Could not determine loaded image name to retag')
        }
      } catch (e) {
        core.debug(`Failed to retag loaded image: ${String(e)}`)
      }
      const dockerCreateContainerResult = await exec.getExecOutput(
        docker,
        [
          'container',
          'create',
          '--name',
          CONTAINER_NAME,
          `${IMAGE_NAME}:latest`
        ],
        this.execOptions()
      )

      if (dockerCreateContainerResult.exitCode !== 0) {
        throw new Error(
          `Failed to create container from cached image: ${dockerCreateContainerResult.stderr}`
        )
      }

      return true
    } finally {
      this.cleanTempCacheFiles()
    }
  }

  private execOptions(): exec.ExecOptions {
    return {
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdline: line => core.debug(line),
        errline: line => core.debug(line)
      }
    }
  }

  private cleanTempCacheFiles() {
    if (fs.existsSync(CONTAINER_IMAGE_PATH)) {
      core.debug(`Deleting temp file ${CONTAINER_IMAGE_PATH}`)
      fs.unlinkSync(CONTAINER_IMAGE_PATH)
    }

    if (fs.existsSync(CONTAINER_IMAGE_CACHE_PATH)) {
      core.debug(`Deleting temp file ${CONTAINER_IMAGE_CACHE_PATH}`)
      fs.unlinkSync(CONTAINER_IMAGE_CACHE_PATH)
    }
  }
}
