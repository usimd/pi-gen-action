import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {
  getExecOptions,
  removeRunnerComponents
} from '../src/increase-runner-disk-size'

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
    jest.spyOn(core, 'getBooleanInput').mockReturnValueOnce(true)

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
      expect.arrayContaining([
        'sh',
        '-c',
        'apt-get autoremove && apt-get autoclean'
      ]),
      expect.anything()
    )

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['swapoff', '-a']),
      expect.anything()
    )
  })

  it('should invoke execution log callbacks only when verbose', async () => {
    jest.spyOn(core, 'info')
    const opts = getExecOptions('docker-system-prune', true)

    opts.listeners?.stdline('test')
    opts.listeners?.errline('test')

    expect(core.info).toHaveBeenCalledTimes(2)
  })
})
