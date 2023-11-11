import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {removeContainer} from '../src/remove-container'

describe('Remove container', () => {
  it('does not fail on non-successful error', async () => {
    const testContainer = 'test-container'
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(false)
    jest
      .spyOn(exec, 'getExecOutput')
      .mockResolvedValue({exitCode: 1} as exec.ExecOutput)

    await removeContainer(testContainer)

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      expect.stringMatching(/.*docker$/),
      ['rm', '-v', testContainer],
      expect.objectContaining({
        ignoreReturnCode: true,
        silent: true
      })
    )
  })

  it('logs info message upon successful removal', async () => {
    const testContainer = 'test-container'
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(true)
    jest
      .spyOn(exec, 'getExecOutput')
      .mockResolvedValue({exitCode: 0} as exec.ExecOutput)
    jest.spyOn(core, 'info')

    await removeContainer(testContainer)

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({silent: false})
    )
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining(testContainer)
    )
  })
})
