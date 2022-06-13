import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {installHostDependencies} from '../src/install-dependencies'

/*
jest.mock('@actions/exec', () => ({
    getExecOutput: jest.fn().mockResolvedValue({exitCode: 0} as exec.ExecOutput)
  }))
*/
describe('Install host dependencies', () => {
  it('respects additional user packages and modules', async () => {
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    jest
      .spyOn(exec, 'getExecOutput')
      .mockResolvedValue({exitCode: 0} as exec.ExecOutput)

    await installHostDependencies('test-package', 'test-module')

    expect(exec.getExecOutput).toBeCalledWith(
      expect.stringMatching(/.*sudo$/),
      expect.arrayContaining(['test-package']),
      expect.anything()
    )
    expect(exec.getExecOutput).toHaveBeenLastCalledWith(
      expect.stringMatching(/.*sudo$/),
      expect.arrayContaining(['test-module']),
      expect.anything()
    )
  })

  it('re-throws errors returned from command executions', async () => {
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    jest
      .spyOn(exec, 'getExecOutput')
      .mockImplementation(
        (cmdLine: string, args?: string[], options?: exec.ExecOptions) => {
          throw new Error()
        }
      )

    await expect(
      async () => await installHostDependencies('', '')
    ).rejects.toThrow()
  })
})
