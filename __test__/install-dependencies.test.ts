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
})
