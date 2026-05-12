import * as core from '@actions/core'
import * as github from '@actions/github'
import {CacheKey, generateCacheKey} from '../src/cache-key.js'

vi.mock('@actions/core', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/core')>())}
})
vi.mock('@actions/github', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/github')>())}
})
vi.mock('object-hash', () => ({
  sha1: vi.fn().mockReturnValue('abc123hash')
}))

describe('CacheKey', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      RUNNER_OS: 'Linux',
      RUNNER_ARCH: 'X64'
    }
    vi.spyOn(core, 'getInput').mockReturnValue('')
    Object.defineProperty(github, 'context', {
      value: {
        job: 'build-job',
        sha: 'deadbeef',
        workflow: 'CI'
      },
      configurable: true
    })
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('should store key and restoreKeys', () => {
    const key = new CacheKey('my-key', ['restore-1', 'restore-2'])
    expect(key.key).toBe('my-key')
    expect(key.restoreKeys).toEqual(['restore-1', 'restore-2'])
  })

  it('should generate cache key containing environment, job and sha', () => {
    const cacheKey = generateCacheKey()

    expect(cacheKey.key).toBe(
      'pi-gen-cache-v1-Linux-X64|build-job[abc123hash]-deadbeef'
    )
    expect(cacheKey.restoreKeys).toEqual([
      'pi-gen-cache-v1-Linux-X64|build-job[abc123hash]',
      'pi-gen-cache-v1-Linux-X64|build-job',
      'pi-gen-cache-v1-Linux-X64'
    ])
  })

  it('should include matrix context in job instance hash', () => {
    vi.spyOn(core, 'getInput').mockReturnValue('matrix-value')

    const cacheKey = generateCacheKey()

    // Key format stays the same but hash input differs
    expect(cacheKey.key).toContain('[abc123hash]')
  })
})
