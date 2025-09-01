// This is heavily borrowed from https://github.com/gradle/actions/blob/707359876a764dbcdb9da0b0ed08291818310c3d/sources/src/caching/cache-key.ts
import * as github from '@actions/github'
import * as core from '@actions/core'
import {sha1} from 'object-hash'

const CACHE_PREFIX = 'pi-gen'

export class CacheKey {
  key: string
  restoreKeys: string[]

  constructor(key: string, restoreKeys: string[]) {
    this.key = key
    this.restoreKeys = restoreKeys
  }
}

export function generateCacheKey(): CacheKey {
  const cacheKeyForEnvironment = `${CACHE_PREFIX}-${process.env['RUNNER_OS']}-${process.env['RUNNER_ARCH']}`
  const cacheKeyForJob = `${cacheKeyForEnvironment}|${github.context.job}`
  const cacheKeyForJobContext = `${cacheKeyForJob}[${getCacheKeyJobInstance()}]`
  const cacheKey = `${cacheKeyForJobContext}-${github.context.sha}`

  return new CacheKey(cacheKey, [
    cacheKeyForJobContext,
    cacheKeyForJob,
    cacheKeyForEnvironment
  ])
}

function getCacheKeyJobInstance(): string {
  const workflowName = github.context.workflow
  const workflowJobContext = core.getInput('internal-matrix-context')
  return sha1([workflowName, workflowJobContext])
}
