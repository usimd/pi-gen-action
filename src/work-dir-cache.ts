import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as fs from 'fs'
import {CacheKey} from './cache-key.js'

const WORK_DIR_CACHE_PATH = '/tmp/pi-gen-work'
const WORK_DIR_ARCHIVE = '/tmp/pi-gen-work.tar.zst'

export class WorkDirCache {
  constructor(private cacheKey: CacheKey) {}

  async save(): Promise<void> {
    try {
      if (!fs.existsSync(WORK_DIR_CACHE_PATH)) {
        core.warning('Work directory not found on host, nothing to cache')
        return
      }

      // Check if cache key already exists before expensive compression
      const existing = await cache.restoreCache(
        [WORK_DIR_ARCHIVE],
        this.cacheKey.key,
        [],
        {lookupOnly: true}
      )
      if (existing) {
        core.info(
          `Cache already exists for key ${this.cacheKey.key}, skipping save`
        )
        return
      }

      core.info('Compressing work directory with zstd')

      const sudo = await io.which('sudo', true)

      const tarResult = await exec.getExecOutput(
        sudo,
        [
          'tar',
          '--use-compress-program=zstd -T0 -10 --long=31',
          '--exclude=./*/rootfs/proc/*',
          '--exclude=./*/rootfs/sys/*',
          '--exclude=./*/rootfs/dev/*',
          '-cf',
          WORK_DIR_ARCHIVE,
          '-C',
          WORK_DIR_CACHE_PATH,
          '.'
        ],
        {silent: true, ignoreReturnCode: true}
      )

      if (tarResult.exitCode !== 0) {
        throw new Error(
          `Failed to compress work directory: ${tarResult.stderr}`
        )
      }

      const archiveSize = fs.statSync(WORK_DIR_ARCHIVE).size
      core.info(
        `Compressed archive size: ${(archiveSize / (1024 * 1024)).toFixed(0)} MB`
      )

      await cache.saveCache([WORK_DIR_ARCHIVE], this.cacheKey.key)
      core.info(`Work directory cached with key: ${this.cacheKey.key}`)
    } finally {
      await WorkDirCache.removeArchive()
    }
  }

  async restore(): Promise<boolean> {
    try {
      // Ensure the mount path exists
      if (!fs.existsSync(WORK_DIR_CACHE_PATH)) {
        fs.mkdirSync(WORK_DIR_CACHE_PATH, {recursive: true})
      }

      const restoredCache = await cache.restoreCache(
        [WORK_DIR_ARCHIVE],
        this.cacheKey.key,
        this.cacheKey.restoreKeys,
        {segmentTimeoutInMs: 10 * 60 * 1000}
      )

      if (restoredCache === undefined) {
        core.info('No work directory cache found')
        return false
      }

      core.info(`Restored work directory cache from key: ${restoredCache}`)

      if (!fs.existsSync(WORK_DIR_ARCHIVE)) {
        core.warning('Cache restored but archive file not found')
        return false
      }

      core.info('Decompressing work directory')

      const sudo = await io.which('sudo', true)

      const extractResult = await exec.getExecOutput(
        sudo,
        [
          'tar',
          '--use-compress-program=zstd -T0 --long=31',
          '-xf',
          WORK_DIR_ARCHIVE,
          '-C',
          WORK_DIR_CACHE_PATH
        ],
        {silent: true, ignoreReturnCode: true}
      )

      if (extractResult.exitCode !== 0) {
        core.warning(
          `Failed to decompress work directory: ${extractResult.stderr}`
        )
        return false
      }

      core.info('Work directory restored successfully')
      return true
    } catch (error) {
      core.warning(
        `Failed to restore work directory cache: ${(error as Error).message}`
      )
      return false
    } finally {
      // Always clean up the archive
      await WorkDirCache.removeArchive()
    }
  }

  private static async removeArchive(): Promise<void> {
    if (fs.existsSync(WORK_DIR_ARCHIVE)) {
      const sudo = await io.which('sudo', true)
      await exec.exec(sudo, ['rm', '-f', WORK_DIR_ARCHIVE], {silent: true})
    }
  }

  get workDirMountPath(): string {
    return WORK_DIR_CACHE_PATH
  }
}
