import * as exec from '@actions/exec'
import {removeRunnerComponents} from '../src/increase-runner-disk-size'

jest.mock('@actions/exec')

describe('Increasing runner disk size', () => {
  it('should prune Docker system, remove defined host paths and invoke apt', async () => {
    jest
      .spyOn(exec, 'getExecOutput')
      .mockImplementation((commandLine, args, options) => {
        if (commandLine === 'sh') {
          return Promise.resolve({stdout: ' 12345 '} as exec.ExecOutput)
        } else {
          return Promise.resolve({} as exec.ExecOutput)
        }
      })
    await removeRunnerComponents()

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['docker', 'system', 'prune']),
      expect.anything()
    )

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['rm', '-rf']),
      expect.anything()
    )

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['apt-get', 'autoremove']),
      expect.anything()
    )

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['apt-get', 'autoclean']),
      expect.anything()
    )

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['swapoff', '-a']),
      expect.anything()
    )
  })
})
