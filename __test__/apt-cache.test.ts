import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as fs from 'fs'
import {AptCache} from '../src/apt-cache.js'

vi.mock('@actions/cache')
vi.mock('@actions/exec')
vi.mock('@actions/io')
vi.mock('@actions/core', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/core')>())}
})
vi.mock('fs', async importOriginal => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
  mkdirSync: vi.fn()
}))

const mockedCache = vi.mocked(cache)
const mockedExec = vi.mocked(exec)
const mockedIo = vi.mocked(io)
const mockedFs = vi.mocked(fs)

describe('AptCache', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = {...OLD_ENV, RUNNER_OS: 'Linux', RUNNER_ARCH: 'X64'}
    mockedIo.which.mockResolvedValue('/usr/bin/docker')
    vi.spyOn(core, 'info').mockImplementation()
    vi.spyOn(core, 'warning').mockImplementation()
    vi.spyOn(core, 'debug').mockImplementation()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('should construct cache key from release and pi-gen SHA', () => {
    const apt = new AptCache('bookworm', 'abc1234')
    expect(apt.proxyUrl).toBe('http://172.17.0.1:3142')
  })

  it('should fallback to Linux/X64 when env vars are not set', () => {
    delete process.env['RUNNER_OS']
    delete process.env['RUNNER_ARCH']
    const apt = new AptCache('bookworm', 'abc1234')
    // Cache key should still contain Linux
    expect(apt.proxyUrl).toBe('http://172.17.0.1:3142')
  })

  describe('restore', () => {
    it('should create cache dir and call restoreCache', async () => {
      mockedFs.existsSync.mockReturnValue(false)
      mockedCache.restoreCache.mockResolvedValue('some-key')

      const apt = new AptCache('bookworm', 'abc1234')
      const result = await apt.restore()

      expect(result).toBe(true)
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/apt-cacher-ng', {
        recursive: true
      })
      expect(mockedCache.restoreCache).toHaveBeenCalled()
    })

    it('should return false on cache miss', async () => {
      mockedFs.existsSync.mockReturnValue(true)
      mockedCache.restoreCache.mockResolvedValue(undefined)

      const apt = new AptCache('bookworm', 'abc1234')
      const result = await apt.restore()

      expect(result).toBe(false)
    })
  })

  describe('start', () => {
    it('should remove existing container and start new one', async () => {
      mockedExec.exec.mockResolvedValue(0)
      mockedExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'container-id',
        stderr: ''
      })

      const apt = new AptCache('bookworm', 'abc1234')
      await apt.start()

      expect(mockedExec.exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['rm', '-f', 'pi-gen-apt-cache'],
        expect.any(Object)
      )
      expect(mockedExec.getExecOutput).toHaveBeenCalledWith(
        '/usr/bin/docker',
        expect.arrayContaining(['run', '-d', '--name', 'pi-gen-apt-cache']),
        expect.any(Object)
      )
    })

    it('should throw when container fails to start', async () => {
      mockedExec.exec.mockResolvedValue(0)
      mockedExec.getExecOutput.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'port already in use'
      })

      const apt = new AptCache('bookworm', 'abc1234')
      await expect(apt.start()).rejects.toThrow('port already in use')
    })

    it('should warn when proxy does not become ready in time', async () => {
      // curl always fails (proxy never ready)
      mockedExec.getExecOutput.mockResolvedValue({
        exitCode: 7,
        stdout: '',
        stderr: 'Connection refused'
      })
      vi.spyOn(core, 'warning').mockImplementation()

      const apt = new AptCache('bookworm', 'abc1234')
      // Use short timeout to avoid slow test
      await (apt as any).waitForProxy(50, 10)

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('did not become ready')
      )
    })
  })

  describe('stop', () => {
    it('should stop and remove container', async () => {
      mockedExec.exec.mockResolvedValue(0)

      const apt = new AptCache('bookworm', 'abc1234')
      await apt.stop()

      expect(mockedExec.exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['stop', 'pi-gen-apt-cache'],
        expect.any(Object)
      )
      expect(mockedExec.exec).toHaveBeenCalledWith(
        '/usr/bin/docker',
        ['rm', 'pi-gen-apt-cache'],
        expect.any(Object)
      )
    })
  })

  describe('save', () => {
    it('should stop container and save cache', async () => {
      mockedExec.exec.mockResolvedValue(0)
      mockedExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: '100M\t/tmp/apt-cacher-ng',
        stderr: ''
      })
      mockedCache.saveCache.mockResolvedValue(1)

      const apt = new AptCache('bookworm', 'abc1234')
      await apt.save()

      expect(mockedCache.saveCache).toHaveBeenCalledWith(
        ['/tmp/apt-cacher-ng'],
        'pi-gen-apt-v1-Linux-X64-bookworm-abc1234'
      )
    })

    it('should skip save when cache key already exists', async () => {
      mockedExec.exec.mockResolvedValue(0)
      mockedCache.restoreCache.mockResolvedValueOnce(
        'pi-gen-apt-v1-Linux-X64-bookworm-abc1234'
      )

      const apt = new AptCache('bookworm', 'abc1234')
      await apt.save()

      expect(mockedCache.saveCache).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      )
    })

    it('should warn when saveCache returns -1', async () => {
      mockedExec.exec.mockResolvedValue(0)
      mockedExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: '50M\t/tmp/apt-cacher-ng',
        stderr: ''
      })
      mockedCache.saveCache.mockResolvedValue(-1)

      const apt = new AptCache('bookworm', 'abc1234')
      await apt.save()

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('may not have been saved')
      )
    })

    it('should warn on save failure without throwing', async () => {
      mockedExec.exec.mockResolvedValue(0)
      mockedExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: '0\t/tmp/apt-cacher-ng',
        stderr: ''
      })
      mockedCache.saveCache.mockRejectedValue(new Error('key exists'))

      const apt = new AptCache('bookworm', 'abc1234')
      await apt.save()

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('key exists')
      )
    })
  })
})
