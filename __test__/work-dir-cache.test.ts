import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as fs from 'fs'
import {WorkDirCache} from '../src/work-dir-cache.js'
import {CacheKey} from '../src/cache-key.js'

vi.mock('@actions/cache')
vi.mock('@actions/exec')
vi.mock('@actions/io')
vi.mock('fs', async importOriginal => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn()
}))

const mockedCache = vi.mocked(cache)
const mockedExec = vi.mocked(exec)
const mockedIo = vi.mocked(io)
const mockedFs = vi.mocked(fs)

function successExec(stdout = ''): exec.ExecOutput {
  return {exitCode: 0, stdout, stderr: ''}
}

function failExec(stderr = 'error'): exec.ExecOutput {
  return {exitCode: 1, stdout: '', stderr}
}

describe('WorkDirCache', () => {
  const cacheKey = new CacheKey('test-key', ['restore-1', 'restore-2'])

  beforeEach(() => {
    vi.spyOn(core, 'info').mockImplementation()
    vi.spyOn(core, 'warning').mockImplementation()
    vi.spyOn(core, 'debug').mockImplementation()
    mockedFs.existsSync.mockReturnValue(false)
    mockedFs.mkdirSync.mockImplementation()
    mockedIo.which.mockResolvedValue('/usr/bin/sudo')
    mockedExec.exec.mockResolvedValue(0)
  })

  it('should expose workDirMountPath', () => {
    const wdc = new WorkDirCache(cacheKey)
    expect(wdc.workDirMountPath).toBe('/tmp/pi-gen-work')
  })

  describe('save', () => {
    it('should tar+zstd the host work dir and save to cache', async () => {
      mockedFs.existsSync
        .mockReturnValueOnce(true) // work dir exists
        .mockReturnValueOnce(true) // archive exists in finally
      mockedExec.getExecOutput.mockResolvedValueOnce(successExec())
      mockedFs.statSync.mockReturnValue({size: 524288} as unknown as fs.Stats)
      mockedCache.saveCache.mockResolvedValue(1)

      const wdc = new WorkDirCache(cacheKey)
      await wdc.save()

      expect(mockedExec.getExecOutput).toHaveBeenCalledWith(
        '/usr/bin/sudo',
        expect.arrayContaining([
          'tar',
          '--use-compress-program=zstd -T0 -3',
          '-cf',
          '/tmp/pi-gen-work.tar.zst'
        ]),
        expect.any(Object)
      )
      expect(mockedCache.saveCache).toHaveBeenCalledWith(
        ['/tmp/pi-gen-work.tar.zst'],
        'test-key'
      )
    })

    it('should do nothing when work dir does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false)

      const wdc = new WorkDirCache(cacheKey)
      await wdc.save()

      expect(mockedExec.getExecOutput).not.toHaveBeenCalled()
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('nothing to cache')
      )
    })

    it('should throw when tar fails', async () => {
      mockedFs.existsSync.mockReturnValueOnce(true)
      mockedExec.getExecOutput.mockResolvedValueOnce(
        failExec('compression failed')
      )

      const wdc = new WorkDirCache(cacheKey)
      await expect(wdc.save()).rejects.toThrow('compression failed')
    })

    it('should clean up archive in finally block', async () => {
      mockedFs.existsSync
        .mockReturnValueOnce(true) // work dir exists
        .mockReturnValueOnce(true) // archive exists in finally
      mockedExec.getExecOutput.mockResolvedValueOnce(successExec())
      mockedFs.statSync.mockReturnValue({size: 1024} as unknown as fs.Stats)
      mockedCache.saveCache.mockResolvedValue(1)

      const wdc = new WorkDirCache(cacheKey)
      await wdc.save()

      expect(mockedExec.exec).toHaveBeenCalledWith(
        '/usr/bin/sudo',
        ['rm', '-f', '/tmp/pi-gen-work.tar.zst'],
        {silent: true}
      )
    })
  })

  describe('restore', () => {
    it('should create mount dir, restore cache, and extract', async () => {
      mockedFs.existsSync
        .mockReturnValueOnce(false) // dir does not exist -> mkdirSync
        .mockReturnValueOnce(true) // archive exists after restore
        .mockReturnValueOnce(true) // archive exists in finally
      mockedCache.restoreCache.mockResolvedValue('restored-key')
      mockedExec.getExecOutput.mockResolvedValueOnce(successExec())

      const wdc = new WorkDirCache(cacheKey)
      const result = await wdc.restore()

      expect(result).toBe(true)
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/pi-gen-work', {
        recursive: true
      })
      expect(mockedCache.restoreCache).toHaveBeenCalledWith(
        ['/tmp/pi-gen-work.tar.zst'],
        'test-key',
        ['restore-1', 'restore-2'],
        expect.any(Object)
      )
      expect(mockedExec.getExecOutput).toHaveBeenCalledWith(
        '/usr/bin/sudo',
        expect.arrayContaining([
          'tar',
          '--use-compress-program=zstd -T0',
          '-xf',
          '/tmp/pi-gen-work.tar.zst'
        ]),
        expect.any(Object)
      )
    })

    it('should return false on cache miss', async () => {
      mockedFs.existsSync.mockReturnValue(false)
      mockedCache.restoreCache.mockResolvedValue(undefined)

      const wdc = new WorkDirCache(cacheKey)
      const result = await wdc.restore()

      expect(result).toBe(false)
    })

    it('should return false when archive not found after restore', async () => {
      mockedFs.existsSync.mockReturnValue(false)
      mockedCache.restoreCache.mockResolvedValue('key')

      const wdc = new WorkDirCache(cacheKey)
      const result = await wdc.restore()

      expect(result).toBe(false)
      expect(core.warning).toHaveBeenCalledWith(
        'Cache restored but archive file not found'
      )
    })

    it('should return false when extraction fails', async () => {
      mockedFs.existsSync
        .mockReturnValueOnce(false) // mkdirSync check
        .mockReturnValueOnce(true) // archive exists
        .mockReturnValueOnce(true) // archive in finally
      mockedCache.restoreCache.mockResolvedValue('key')
      mockedExec.getExecOutput.mockResolvedValueOnce(
        failExec('decompress error')
      )

      const wdc = new WorkDirCache(cacheKey)
      const result = await wdc.restore()

      expect(result).toBe(false)
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('decompress error')
      )
    })

    it('should return false and warn on thrown error', async () => {
      mockedFs.existsSync.mockReturnValue(false)
      mockedCache.restoreCache.mockRejectedValue(new Error('network error'))

      const wdc = new WorkDirCache(cacheKey)
      const result = await wdc.restore()

      expect(result).toBe(false)
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('network error')
      )
    })
  })
})
