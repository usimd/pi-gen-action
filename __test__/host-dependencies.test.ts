import {describe, it, expect, beforeEach, vi} from 'vitest'

describe('host dependencies', () => {
  beforeEach(() => {
    // Clear the module cache to force re-evaluation on each test
    vi.resetModules()
  })

  it('includes binfmt packages and modules on x64', async () => {
    // Mock process.arch before importing
    Object.defineProperty(process, 'arch', {
      value: 'x64',
      writable: true,
      configurable: true
    })

    const {hostDependencies} = await import('../src/host-dependencies.js')

    expect(hostDependencies.packages).toContain('zstd')
    expect(hostDependencies.packages).toContain('binfmt-support')
    expect(hostDependencies.packages).toContain('qemu-user-static')
    expect(hostDependencies.modules).toContain('binfmt_misc')
  })

  it('excludes binfmt packages and modules on arm64', async () => {
    // Mock process.arch before importing
    Object.defineProperty(process, 'arch', {
      value: 'arm64',
      writable: true,
      configurable: true
    })

    const {hostDependencies} = await import('../src/host-dependencies.js')

    expect(hostDependencies.packages).toContain('zstd')
    expect(hostDependencies.packages).not.toContain('binfmt-support')
    expect(hostDependencies.packages).not.toContain('qemu-user-static')
    expect(hostDependencies.modules).not.toContain('binfmt_misc')
  })
})
