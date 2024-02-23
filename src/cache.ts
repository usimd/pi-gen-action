import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as fs from 'fs'
import {CacheKey} from './cache-key'

const CONTAINER_IMAGE_PATH = '/tmp/pi-gen.tar'
const CONTAINER_IMAGE_CACHE_PATH = `${CONTAINER_IMAGE_PATH}.lrz`
const CONTAINER_NAME = 'pigen_work'

export class Cache {
  constructor(private cacheKey: CacheKey) {}

  public async cacheContainer() {
    try {
      const docker = await io.which('docker', true)
      const lrzip = await io.which('lrzip', true)

      core.debug(`Found 'docker' command at ${docker}`)
      core.debug(`Found 'lrzip' command at ${lrzip}`)

      core.info('Creating a snapshot image of pi-gen container')

      const containerCommitResult = await exec.getExecOutput(
        docker,
        ['container', 'commit', CONTAINER_NAME, `${CONTAINER_NAME}:latest`],
        this.execOptions()
      )

      if (containerCommitResult.exitCode !== 0) {
        throw new Error(
          `Failed to execute 'docker container commit' for pi-gen container: ${containerCommitResult.stderr}`
        )
      }

      core.info('Dumping pi-gen build container to file')

      const containerSaveResult = await exec.getExecOutput(
        docker,
        ['save', '--output', CONTAINER_IMAGE_PATH, `${CONTAINER_NAME}:latest`],
        this.execOptions()
      )

      if (containerSaveResult.exitCode !== 0) {
        throw new Error(
          `Failed to execute 'docker save' for pi-gen container image: ${containerSaveResult.stderr}`
        )
      }

      core.info('Compressing container image before uploading to cache')

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
          `Failed to load cached pi-gen container to Docker daemon: ${dockerLoadResult.stderr}`
        )
      }

      const dockerCreateContainerResult = await exec.getExecOutput(
        docker,
        [
          'container',
          'create',
          '--name',
          CONTAINER_NAME,
          `${CONTAINER_NAME}:latest`
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
