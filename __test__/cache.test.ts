import * as core from '@actions/core'
import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as fs from 'fs'
import os from 'os'
import path from 'path'

import {Cache} from '../src/cache'

jest.mock('@actions/cache')
jest.mock('@actions/io')
jest.mock('@actions/exec')

describe('Cache', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {...OLD_ENV}
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('should upload compressed container image to cache on success', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(exec.getExecOutput as jest.Mock).mockResolvedValue({exitCode: 0})

    // create the temp files expected by the implementation rather than mocking fs
    const tmp = os.tmpdir()
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar'), '')
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar.lrz'), '')

    const key = {key: 'my-cache-key', restoreKeys: ['rk1', 'rk2', 'rk3']} as any
    const c = new Cache(key)

    await expect(c.cacheContainer()).resolves.not.toThrow()

    expect(cache.saveCache).toHaveBeenCalledWith(
      ['/tmp/pi-gen.tar.lrz'],
      'my-cache-key'
    )
  })

  it('should throw when `docker commit` fails', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(exec.getExecOutput as jest.Mock).mockImplementation(
      async (_cmd, args) => {
        if (args && args.includes('commit')) {
          return {exitCode: 1, stderr: 'commit failed'}
        }
        return {exitCode: 0}
      }
    )

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.cacheContainer()).rejects.toThrow('commit failed')
  })

  it('restoreContainer returns false when no cache hit', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(cache.restoreCache as jest.Mock).mockResolvedValue(undefined)
    // ensure no temp files exist
    try {
      fs.unlinkSync('/tmp/pi-gen.tar.lrz')
    } catch {}

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.restoreContainer()).resolves.toBe(false)
  })

  it('restoreContainer returns true and loads image on cache hit', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(cache.restoreCache as jest.Mock).mockResolvedValue('restored-key')
    ;(exec.getExecOutput as jest.Mock).mockResolvedValue({exitCode: 0})
    // create expected files
    const tmp = os.tmpdir()
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar.lrz'), '')
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar'), '')

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.restoreContainer()).resolves.toBe(true)

    // verify lrzip uncompress was invoked
    expect(
      (exec.getExecOutput as jest.Mock).mock.calls.some(
        ([cmd, args]) =>
          /lrzip$/.test(cmd) &&
          Array.isArray(args) &&
          args[0] === '-v' &&
          args[1] === '-d'
      )
    ).toBeTruthy()

    // verify a docker load call happened (args contain 'load' and '-i')
    expect(
      (exec.getExecOutput as jest.Mock).mock.calls.some(
        ([cmd, args]) =>
          /docker$/.test(cmd) &&
          Array.isArray(args) &&
          args.includes('load') &&
          args.includes('-i')
      )
    ).toBeTruthy()

    // verify container create was invoked
    expect(
      (exec.getExecOutput as jest.Mock).mock.calls.some(
        ([cmd, args]) =>
          /docker$/.test(cmd) &&
          Array.isArray(args) &&
          args.includes('container') &&
          args.includes('create') &&
          args.includes('--name') &&
          args.includes('pigen_work')
      )
    ).toBeTruthy()
  })

  it('throws when docker save fails', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(exec.getExecOutput as jest.Mock).mockImplementation(
      async (_cmd, args) => {
        if (args && args.includes('commit')) return {exitCode: 0}
        if (args && args.includes('save'))
          return {exitCode: 1, stderr: 'save failed'}
        return {exitCode: 0}
      }
    )

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.cacheContainer()).rejects.toThrow('save failed')
  })

  it('throws when lrzip fails during cache', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(exec.getExecOutput as jest.Mock).mockImplementation(
      async (_cmd, args) => {
        if (args && args.includes('commit')) return {exitCode: 0}
        if (args && args.includes('save')) return {exitCode: 0}
        if (/_?lrzip$/.test(String(_cmd)))
          return {exitCode: 1, stderr: 'lrzip failed'}
        return {exitCode: 0}
      }
    )

    // create the temp file that lrzip would compress
    const tmp = os.tmpdir()
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar'), '')

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.cacheContainer()).rejects.toThrow('lrzip failed')
  })

  it('throws when uncompress fails during restore', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(cache.restoreCache as jest.Mock).mockResolvedValue('restored-key')
    ;(exec.getExecOutput as jest.Mock).mockImplementation(
      async (_cmd, args) => {
        // simulate failing uncompress
        if (
          /_?lrzip$/.test(String(_cmd)) &&
          Array.isArray(args) &&
          args.includes('-d')
        ) {
          return {exitCode: 1, stderr: 'uncompress failed'}
        }
        return {exitCode: 0}
      }
    )

    // ensure expected cache file exists
    const tmp = os.tmpdir()
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar.lrz'), '')

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.restoreContainer()).rejects.toThrow('uncompress failed')
  })

  it('throws when docker load fails during restore', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(cache.restoreCache as jest.Mock).mockResolvedValue('restored-key')
    ;(exec.getExecOutput as jest.Mock).mockImplementation(
      async (_cmd, args) => {
        if (
          /_?lrzip$/.test(String(_cmd)) &&
          Array.isArray(args) &&
          args.includes('-d')
        )
          return {exitCode: 0}
        if (
          /_?docker$/.test(String(_cmd)) &&
          Array.isArray(args) &&
          args.includes('load')
        )
          return {exitCode: 1, stderr: 'load failed'}
        return {exitCode: 0}
      }
    )

    const tmp = os.tmpdir()
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar.lrz'), '')
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar'), '')

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.restoreContainer()).rejects.toThrow('load failed')
  })

  it('throws when docker create fails during restore', async () => {
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/docker')
    ;(io.which as jest.Mock).mockResolvedValueOnce('/usr/bin/lrzip')
    ;(cache.restoreCache as jest.Mock).mockResolvedValue('restored-key')
    ;(exec.getExecOutput as jest.Mock).mockImplementation(
      async (_cmd, args) => {
        if (
          /_?lrzip$/.test(String(_cmd)) &&
          Array.isArray(args) &&
          args.includes('-d')
        )
          return {exitCode: 0}
        if (
          /_?docker$/.test(String(_cmd)) &&
          Array.isArray(args) &&
          args.includes('load')
        )
          return {exitCode: 0}
        if (
          /_?docker$/.test(String(_cmd)) &&
          Array.isArray(args) &&
          args.includes('container') &&
          args.includes('create')
        )
          return {exitCode: 1, stderr: 'create failed'}
        return {exitCode: 0}
      }
    )

    const tmp = os.tmpdir()
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar.lrz'), '')
    fs.writeFileSync(path.join(tmp, 'pi-gen.tar'), '')

    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    await expect(c.restoreContainer()).rejects.toThrow('create failed')
  })

  it('execOptions listeners call core.debug', () => {
    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)
    const spy = jest.spyOn(core, 'debug').mockImplementation(() => undefined)

    const opts = (c as any).execOptions()
    // call the listeners to ensure they're executed
    opts.listeners.stdline('std')
    opts.listeners.errline('err')

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('cleanTempCacheFiles deletes temp files if present', () => {
    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    // create files that should be removed
    const tmp = os.tmpdir()
    const tar = path.join(tmp, 'pi-gen.tar')
    const lrz = path.join(tmp, 'pi-gen.tar.lrz')
    fs.writeFileSync(tar, '')
    fs.writeFileSync(lrz, '')

    expect(fs.existsSync(tar)).toBe(true)
    expect(fs.existsSync(lrz)).toBe(true)
    ;(c as any).cleanTempCacheFiles()

    expect(fs.existsSync(tar)).toBe(false)
    expect(fs.existsSync(lrz)).toBe(false)
  })

  it('cleanTempCacheFiles is safe when files are missing', () => {
    const key = {key: 'k', restoreKeys: []} as any
    const c = new Cache(key)

    const tmp = os.tmpdir()
    const tar = path.join(tmp, 'pi-gen.tar')
    const lrz = path.join(tmp, 'pi-gen.tar.lrz')
    try {
      fs.unlinkSync(tar)
    } catch {}
    try {
      fs.unlinkSync(lrz)
    } catch {}

    expect(() => (c as any).cleanTempCacheFiles()).not.toThrow()
  })
})

describe('CacheKey generation', () => {
  it('generates a deterministic key and restore keys', () => {
    jest.resetModules()
    // mock dependencies before loading cache-key implementation
    jest.doMock('object-hash', () => ({
      sha1: jest.fn().mockReturnValue('hashsha')
    }))
    jest.doMock('@actions/github', () => ({
      context: {job: 'job-name', sha: 'deadbeef', workflow: 'wf-name'}
    }))

    jest.spyOn(core, 'getInput').mockImplementation(name => {
      if (name === 'internal-matrix-context') return 'matrix-ctx'
      return ''
    })

    process.env['RUNNER_OS'] = 'LINUX'
    process.env['RUNNER_ARCH'] = 'X64'

    const {generateCacheKey} = require('../src/cache-key')
    const k = generateCacheKey()

    expect(k.key).toContain('pi-gen-LINUX-X64')
    expect(k.key).toContain('job-name')
    expect(k.key).toContain('deadbeef')
    expect(k.restoreKeys).toHaveLength(3)

    // first restore key should include the hashed job instance (mocked to 'hashsha')
    expect(k.restoreKeys[0]).toContain('[hashsha]')
  })
})
