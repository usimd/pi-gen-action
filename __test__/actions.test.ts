import * as core from '@actions/core'
import {DEFAULT_CONFIG} from '../src/pi-gen-config.js'
import * as actions from '../src/actions.js'
import {removeContainer} from '../src/remove-container.js'
import {build} from '../src/build.js'
import {removeRunnerComponents} from '../src/increase-runner-disk-size.js'
import {WorkDirCache} from '../src/work-dir-cache.js'
import {AptCache} from '../src/apt-cache.js'

vi.mock('@actions/core', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/core')>())}
})
vi.mock('../src/configure.js', () => ({
  configure: vi.fn().mockReturnValue({...DEFAULT_CONFIG})
}))
vi.mock('../src/install-dependencies.js')
vi.mock('../src/build.js')
vi.mock('../src/clone-pigen.js')
vi.mock('../src/remove-container.js')
vi.mock('../src/increase-runner-disk-size.js')
vi.mock('../src/work-dir-cache.js')
vi.mock('../src/apt-cache.js')
vi.mock('../src/cache-key.js', () => ({
  generateCacheKey: vi.fn().mockReturnValue({
    key: 'test-key',
    restoreKeys: ['restore-1']
  }),
  CacheKey: vi.fn()
}))

const MockedWorkDirCache = vi.mocked(WorkDirCache)
const MockedAptCache = vi.mocked(AptCache)

describe('Actions', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {...OLD_ENV}
    MockedWorkDirCache.mockClear()
    MockedAptCache.mockClear()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('should only increase disk space if requested', async () => {
    vi.spyOn(core, 'getBooleanInput')
      .mockReturnValueOnce(true) // increase-runner-disk-size
      .mockReturnValueOnce(false) // enable-pigen-cache

    await actions.piGen()

    expect(removeRunnerComponents).toHaveBeenCalled()
  })

  it('should setup caching when enable-pigen-cache is true', async () => {
    const mockRestore = vi.fn().mockResolvedValue(true)
    MockedWorkDirCache.mockImplementation(
      () =>
        ({restore: mockRestore, workDirMountPath: '/tmp/pi-gen-work'}) as any
    )
    const mockAptRestore = vi.fn().mockResolvedValue(true)
    const mockAptStart = vi.fn().mockResolvedValue(undefined)
    MockedAptCache.mockImplementation(
      () =>
        ({
          restore: mockAptRestore,
          start: mockAptStart,
          proxyUrl: 'http://172.17.0.1:3142'
        }) as any
    )

    vi.spyOn(core, 'getBooleanInput')
      .mockReturnValueOnce(false) // increase-runner-disk-size
      .mockReturnValueOnce(true) // enable-pigen-cache
    vi.spyOn(core, 'group').mockImplementation(async (_name, fn) => await fn())

    await actions.piGen()

    expect(MockedWorkDirCache).toHaveBeenCalled()
    expect(mockRestore).toHaveBeenCalled()
    expect(MockedAptCache).toHaveBeenCalled()
    expect(mockAptRestore).toHaveBeenCalled()
    expect(mockAptStart).toHaveBeenCalled()
  })

  it('should warn when apt-proxy is set with caching enabled', async () => {
    const {configure} = await import('../src/configure.js')
    vi.mocked(configure).mockReturnValue({
      ...DEFAULT_CONFIG,
      aptProxy: 'http://user-proxy:3128'
    } as any)

    const mockRestore = vi.fn().mockResolvedValue(false)
    MockedWorkDirCache.mockImplementation(
      () =>
        ({restore: mockRestore, workDirMountPath: '/tmp/pi-gen-work'}) as any
    )
    const mockAptRestore = vi.fn().mockResolvedValue(true)
    const mockAptStart = vi.fn().mockResolvedValue(undefined)
    MockedAptCache.mockImplementation(
      () =>
        ({
          restore: mockAptRestore,
          start: mockAptStart,
          proxyUrl: 'http://172.17.0.1:3142'
        }) as any
    )

    vi.spyOn(core, 'getBooleanInput')
      .mockReturnValueOnce(false) // increase-runner-disk-size
      .mockReturnValueOnce(true) // enable-pigen-cache
    vi.spyOn(core, 'group').mockImplementation(async (_name, fn) => await fn())
    vi.spyOn(core, 'warning')

    await actions.piGen()

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('apt-proxy')
    )
  })

  it('does not run build function twice but invokes cleanup', async () => {
    vi.spyOn(core, 'getState')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')
    process.env['INPUT_INCREASE-RUNNER-DISK-SIZE'] = 'false'
    process.env['INPUT_ENABLE-PIGEN-CACHE'] = 'false'

    await actions.run()

    expect(build).toHaveBeenCalledTimes(0)
    expect(removeContainer).toHaveBeenCalledTimes(1)
  })

  const errorMessage = 'any error'
  it.each([new Error(errorMessage), errorMessage])(
    'should catch errors thrown during build and set build safely as failed',
    async error => {
      vi.spyOn(core, 'getInput').mockImplementation(() => {
        throw error
      })
      vi.spyOn(core, 'getBooleanInput').mockReturnValue(false)
      vi.spyOn(core, 'setFailed')

      await expect(actions.piGen()).resolves.not.toThrow()
      expect(core.setFailed).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  it.each([new Error(errorMessage), errorMessage])(
    'should gracefully catch errors thrown during cleanup and emit a warning message',
    async error => {
      vi.spyOn(core, 'getState').mockReturnValue('true')
      vi.mocked(removeContainer).mockRejectedValue(error)
      vi.spyOn(core, 'warning')

      await expect(actions.cleanup()).resolves.not.toThrow()
      expect(core.warning).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  describe('cleanup', () => {
    it.each(['', 'true'])(
      'tries to remove container only if build has started = %s',
      async buildStarted => {
        vi.spyOn(core, 'getState').mockReturnValueOnce(buildStarted)
        await actions.cleanup()
        expect(removeContainer).toHaveBeenCalledTimes(buildStarted ? 1 : 0)
      }
    )
  })

  describe('saveCache', () => {
    it('should save work dir and apt cache when caching enabled', async () => {
      vi.spyOn(core, 'getBooleanInput').mockReturnValue(true)
      vi.spyOn(core, 'getInput').mockReturnValue('pi-gen')
      vi.spyOn(core, 'group').mockImplementation(
        async (_name, fn) => await fn()
      )

      const mockSave = vi.fn().mockResolvedValue(undefined)
      MockedWorkDirCache.mockImplementation(() => ({save: mockSave}) as any)
      const mockAptSave = vi.fn().mockResolvedValue(undefined)
      MockedAptCache.mockImplementation(() => ({save: mockAptSave}) as any)

      await actions.saveCache()

      expect(mockSave).toHaveBeenCalled()
      expect(mockAptSave).toHaveBeenCalled()
    })

    it('should not save cache when caching disabled', async () => {
      vi.spyOn(core, 'getBooleanInput').mockReturnValue(false)

      await actions.saveCache()

      expect(MockedWorkDirCache).not.toHaveBeenCalled()
      expect(MockedAptCache).not.toHaveBeenCalled()
    })

    it('should set failed on error', async () => {
      vi.spyOn(core, 'getBooleanInput').mockImplementation(() => {
        throw new Error('save error')
      })
      vi.spyOn(core, 'setFailed')

      await actions.saveCache()

      expect(core.setFailed).toHaveBeenCalledWith('save error')
    })

    it('should handle non-Error thrown values', async () => {
      vi.spyOn(core, 'getBooleanInput').mockImplementation(() => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error' as unknown
      })
      vi.spyOn(core, 'setFailed')

      await actions.saveCache()

      expect(core.setFailed).toHaveBeenCalledWith('string error')
    })
  })
})
