import * as exec from '@actions/exec'
import * as fsPromises from 'fs/promises'
import * as core from '@actions/core'
import {installHostDependencies} from '../src/install-dependencies.js'

vi.mock('@actions/exec', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/exec')>())}
})
vi.mock('@actions/core', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/core')>())}
})
vi.mock('fs/promises', async importOriginal => {
  return {...(await importOriginal<typeof import('fs/promises')>())}
})

describe('Install host dependencies', () => {
  it('respects additional user packages and modules', async () => {
    vi.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    vi.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0
    } as exec.ExecOutput)

    await installHostDependencies('test-package', 'test-module', '')

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      expect.stringMatching(/.*sudo$/),
      expect.arrayContaining(['test-package']),
      expect.anything()
    )
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      expect.stringMatching(/.*sudo$/),
      expect.arrayContaining(['test-module']),
      expect.anything()
    )
  })

  it('re-throws errors returned from command executions', async () => {
    vi.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    vi.spyOn(exec, 'getExecOutput').mockImplementation(
      (cmdLine: string, args?: string[], options?: exec.ExecOptions) => {
        throw new Error()
      }
    )

    await expect(
      async () => await installHostDependencies('', '', '')
    ).rejects.toThrow()
  })

  it('installs dependencies pi-gen suggests in a dependency file', async () => {
    vi.spyOn(core, 'getBooleanInput').mockReturnValue(true)

    vi.spyOn(fsPromises, 'stat').mockResolvedValueOnce({
      isFile: () => true
    } as any)
    vi.spyOn(fsPromises, 'readFile').mockResolvedValueOnce('A\nB\nC:D' as any)
    vi.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0
    } as exec.ExecOutput)

    await installHostDependencies('', '', 'pi-gen')

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      expect.stringMatching(/.*sudo$/),
      expect.arrayContaining(['A', 'B', 'D']),
      expect.anything()
    )
  })

  it('installs qemu-user-binfmt when qemu-user-static is unavailable', async () => {
    vi.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    vi.spyOn(exec, 'getExecOutput').mockImplementation(
      async (cmdLine: string, args?: string[]) =>
        ({
          exitCode: 0,
          stdout: args?.includes('policy')
            ? 'qemu-user-static:\n  Installed: (none)\n  Candidate: (none)\n'
            : ''
        }) as exec.ExecOutput
    )

    await installHostDependencies('qemu-user-static', '', '')

    const installArgs = vi
      .mocked(exec.getExecOutput)
      .mock.calls.find(([, args]) => args?.includes('install'))?.[1]
    expect(installArgs).toContain('qemu-user-binfmt')
    expect(installArgs).not.toContain('qemu-user-static')
  })

  it('links qemu-aarch64 only when the static binary exists', async () => {
    vi.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    vi.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: ''
    } as exec.ExecOutput)
    vi.spyOn(fsPromises, 'access').mockRejectedValueOnce(new Error('ENOENT'))

    await installHostDependencies('', '', '')

    expect(exec.getExecOutput).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['ln']),
      expect.anything()
    )

    vi.mocked(exec.getExecOutput).mockClear()
    vi.spyOn(fsPromises, 'access').mockResolvedValueOnce(undefined)

    await installHostDependencies('', '', '')

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      expect.anything(),
      [
        'ln',
        '-sf',
        '/usr/bin/qemu-aarch64-static',
        '/usr/local/bin/qemu-aarch64'
      ],
      expect.anything()
    )
  })
})
