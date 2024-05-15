import * as core from '@actions/core'
import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import objectHash from 'object-hash'

export class Cache {
  private cacheKeyPrefix = 'pigen-work-'
  private cacheKey: string
  private restoreKeys: string[] = [this.cacheKeyPrefix]

  constructor() {
    core.debug('Adapting permissions of tar')
    exec.exec('sudo', ['chown', 'root', '/usr/bin/tar'], {ignoreReturnCode: true, silent: true})
    exec.exec('sudo', ['chown', 'root', '/bin/tar'], {ignoreReturnCode: true, silent: true})
    exec.exec('sudo', ['chmod', 'u+s', '/usr/bin/tar'], {ignoreReturnCode: true, silent: true})
    exec.exec('sudo', ['chmod', 'u+s', '/usr/bin/tar'], {ignoreReturnCode: true, silent: true})

    const inputVars = Object.keys(process.env)
      .filter(envName => envName.startsWith('INPUT_'))
      .reduce((obj: {[key: string]: string}, envName: string) => {
        obj[envName] = process.env[envName]!
        return obj
      }, {})
    const inputHash = objectHash.sha1(inputVars)
    this.cacheKey = `${this.cacheKeyPrefix}${inputHash}`

    core.debug(`Computed cache key: ${this.cacheKey}`)
  }

  getCacheKey() {
    return this.cacheKey
  }

  async restoreCache(): Promise<void> {
    if (core.getBooleanInput('enable-pigen-cache')) {
      core.info('Restoring pi-gen cache if exists')
      await cache.restoreCache(['pigen-work'], this.cacheKey, this.restoreKeys)
    }
  }

  async saveCache(): Promise<void> {
    if (core.getBooleanInput('enable-pigen-cache')) {
      core.info('Saving pi-gen work directory to GitHub cache')
      await cache.saveCache(['pigen-work'], this.cacheKey)
    }
  }
}
