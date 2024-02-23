import * as core from '@actions/core'
import {DEFAULT_CONFIG} from '../src/pi-gen-config'
import * as actions from '../src/actions'
import {removeRunnerComponents} from '../src/increase-runner-disk-size'
import * as removeContainer from '../src/remove-container'

jest.mock('../src/configure', () => ({
  configure: jest.fn().mockReturnValue(DEFAULT_CONFIG)
}))
jest.mock('../src/install-dependencies')
jest.mock('../src/build')
jest.mock('../src/clone-pigen')
jest.mock('../src/remove-container')
jest.mock('../src/increase-runner-disk-size')

describe('Actions', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {...OLD_ENV}
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('should only increase disk space if requested', async () => {
    jest.spyOn(core, 'getBooleanInput').mockReturnValueOnce(true)

    await actions.main()

    expect(removeRunnerComponents).toHaveBeenCalled()
  })

  const errorMessage = 'any error'
  it.each([new Error(errorMessage), errorMessage])(
    'should catch errors thrown during build and set build safely as failed',
    async error => {
      const errorMessage = 'any error'
      jest.spyOn(core, 'getInput').mockImplementation((name, options) => {
        throw error
      })
      jest.spyOn(core, 'getBooleanInput').mockReturnValue(false)
      jest.spyOn(core, 'setFailed')

      await expect(actions.main()).resolves.not.toThrow()
      expect(core.setFailed).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  it.each([new Error(errorMessage), errorMessage])(
    'should gracefully catch errors thrown during cleanup and emit a warning message',
    async error => {
      jest.spyOn(removeContainer, 'removeContainer').mockRejectedValue(error)
      jest.spyOn(core, 'warning')

      await expect(actions.cleanup()).resolves.not.toThrow()
      expect(core.warning).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  it('should restore cached build container when enable-pigen-cache is true', async () => {
    jest.resetModules()
    const mockCore: any = {
      getBooleanInput: jest.fn(),
      getInput: jest.fn(),
      group: async (name: string, fn: Function) => fn(),
      startGroup: jest.fn(),
      endGroup: jest.fn(),
      setFailed: jest.fn(),
      warning: jest.fn(),
      debug: jest.fn()
    }

    jest.doMock('@actions/core', () => mockCore)

    const restoreMock = jest.fn().mockResolvedValue(true)
    const cacheMock = jest.fn()

    jest.doMock('../src/cache', () => ({
      Cache: jest.fn().mockImplementation(() => ({
        restoreContainer: restoreMock,
        cacheContainer: cacheMock
      }))
    }))

    // mock other heavy modules used by actions.main so main() runs without side effects
    jest.doMock('../src/configure', () => ({
      configure: jest
        .fn()
        .mockResolvedValue(require('../src/pi-gen-config').DEFAULT_CONFIG)
    }))
    jest.doMock('../src/install-dependencies', () => ({
      installHostDependencies: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/build', () => ({
      build: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/clone-pigen', () => ({
      clonePigen: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/remove-container', () => ({
      removeContainer: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/increase-runner-disk-size', () => ({
      removeRunnerComponents: jest.fn().mockResolvedValue(undefined)
    }))

    const {getBooleanInput, getInput} = require('@actions/core') as any
    getBooleanInput.mockImplementation((name: string) => {
      if (name === 'enable-pigen-cache') return true
      if (name === 'increase-runner-disk-size') return false
      return false as any
    })
    getInput.mockReturnValue('')

    const {main: actionsMain} = require('../src/actions')
    const {Cache: MockedCache} = require('../src/cache') as unknown as {
      Cache: jest.Mock
    }

    await expect(actionsMain()).resolves.not.toThrow()

    expect(MockedCache).toHaveBeenCalled()
    const cacheInstance = MockedCache.mock.instances[0]
    expect(restoreMock).toHaveBeenCalled()
  })

  it('should cache build container when caching enabled', async () => {
    jest.resetModules()

    const mockCore: any = {
      getBooleanInput: jest.fn(),
      getInput: jest.fn(),
      group: async (name: string, fn: Function) => fn(),
      startGroup: jest.fn(),
      endGroup: jest.fn(),
      setFailed: jest.fn(),
      warning: jest.fn(),
      debug: jest.fn()
    }

    jest.doMock('@actions/core', () => mockCore)

    const restoreMock = jest.fn().mockResolvedValue(true)
    const cacheMock = jest.fn()

    jest.doMock('../src/cache', () => ({
      Cache: jest.fn().mockImplementation(() => ({
        restoreContainer: restoreMock,
        cacheContainer: cacheMock
      }))
    }))

    jest.doMock('../src/cache-key', () => ({
      generateCacheKey: () => ({key: 'k', restoreKeys: []})
    }))

    const {getBooleanInput, startGroup} = require('@actions/core') as any
    getBooleanInput.mockImplementation(
      (name: string) => name === 'enable-pigen-cache'
    )

    const {saveCache} = require('../src/actions')
    const {Cache: MockedCache} = require('../src/cache') as unknown as {
      Cache: jest.Mock
    }

    await saveCache()

    expect(MockedCache).toHaveBeenCalled()
    const cacheInstance = MockedCache.mock.instances[0]
    expect(startGroup).toHaveBeenCalled()
    expect(cacheMock).toHaveBeenCalled()
  })

  it('should not cache anything when cache disabled', async () => {
    jest.resetModules()
    const mockCore: any = {
      getBooleanInput: jest.fn().mockReturnValue(false),
      getInput: jest.fn(),
      startGroup: jest.fn(),
      endGroup: jest.fn(),
      setFailed: jest.fn(),
      debug: jest.fn()
    }

    jest.doMock('@actions/core', () => mockCore)
    jest.doMock('../src/cache', () => ({Cache: jest.fn()}))

    const {saveCache} = require('../src/actions')

    await expect(saveCache()).resolves.not.toThrow()
    expect(mockCore.startGroup).not.toHaveBeenCalled()
  })

  it('reports failure when cacheContainer throws during saveCache', async () => {
    jest.resetModules()

    const mockCore: any = {
      getBooleanInput: jest.fn(),
      getInput: jest.fn(),
      group: async (name: string, fn: Function) => fn(),
      startGroup: jest.fn(),
      endGroup: jest.fn(),
      setFailed: jest.fn(),
      warning: jest.fn(),
      debug: jest.fn()
    }

    jest.doMock('@actions/core', () => mockCore)

    const cacheMock = jest.fn().mockRejectedValue(new Error('cache fail'))

    jest.doMock('../src/cache', () => ({
      Cache: jest.fn().mockImplementation(() => ({
        cacheContainer: cacheMock
      }))
    }))

    const {getBooleanInput} = require('@actions/core') as any
    getBooleanInput.mockImplementation(
      (name: string) => name === 'enable-pigen-cache'
    )

    const {saveCache} = require('../src/actions')

    await expect(saveCache()).resolves.not.toThrow()
    expect(getBooleanInput('enable-pigen-cache')).toBe(true)
    expect(mockCore.setFailed).toHaveBeenCalled()
  })

  it('should remove runner components when increase-runner-disk-size is true', async () => {
    jest.resetModules()

    const mockCore: any = {
      getBooleanInput: jest.fn(),
      getInput: jest.fn().mockReturnValue(''),
      group: jest.fn(async (_name: string, fn: Function) => fn()),
      startGroup: jest.fn(),
      endGroup: jest.fn(),
      setFailed: jest.fn(),
      debug: jest.fn()
    }

    const removeRunnerMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@actions/core', () => mockCore)
    jest.doMock('../src/configure', () => ({
      configure: jest
        .fn()
        .mockResolvedValue(require('../src/pi-gen-config').DEFAULT_CONFIG)
    }))
    jest.doMock('../src/install-dependencies', () => ({
      installHostDependencies: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/build', () => ({
      build: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/clone-pigen', () => ({
      clonePigen: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/remove-container', () => ({
      removeContainer: jest.fn().mockResolvedValue(undefined)
    }))
    jest.doMock('../src/increase-runner-disk-size', () => ({
      removeRunnerComponents: removeRunnerMock
    }))
    jest.doMock('../src/cache', () => ({
      Cache: jest.fn().mockImplementation(() => ({
        restoreContainer: jest.fn().mockResolvedValue(false)
      }))
    }))

    mockCore.getBooleanInput.mockImplementation(
      (name: string) => name === 'increase-runner-disk-size'
    )

    const {main} = require('../src/actions')

    await expect(main()).resolves.not.toThrow()
    expect(removeRunnerMock).toHaveBeenCalled()
  })
})
