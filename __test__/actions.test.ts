import * as core from '@actions/core'
import {DEFAULT_CONFIG} from '../src/pi-gen-config'
import * as actions from '../src/actions'
import {removeContainer} from '../src/remove-container'
import {build} from '../src/build'
import {removeRunnerComponents} from '../src/increase-runner-disk-size'

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

    await actions.piGen()

    expect(removeRunnerComponents).toHaveBeenCalled()
  })

  it('does not run build function twice but invokes cleanup', async () => {
    jest
      .spyOn(core, 'getState')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')
    process.env['INPUT_INCREASE-RUNNER-DISK-SIZE'] = 'false'

    // expect build here
    await actions.run()
    // expect cleanup here
    await actions.run()

    expect(build).toHaveBeenCalledTimes(1)
    expect(removeContainer).toHaveBeenCalledTimes(1)
  })

  const errorMessage = 'any error'
  it.each([new Error(errorMessage), errorMessage])(
    'should catch errors thrown during build and set build safely as failed',
    async error => {
      const errorMessage = 'any error'
      jest.spyOn(core, 'getInput').mockImplementation((name, options) => {
        throw error
      })
      jest.spyOn(core, 'setFailed')

      await expect(actions.piGen()).resolves.not.toThrow()
      expect(core.setFailed).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  it.each([new Error(errorMessage), errorMessage])(
    'should gracefully catch errors thrown during cleanup and emit a warning message',
    async error => {
      jest.spyOn(core, 'getState').mockImplementation(name => {
        throw error
      })
      jest.spyOn(core, 'warning')

      await expect(actions.cleanup()).resolves.not.toThrow()
      expect(core.warning).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  describe('cleanup', () => {
    it.each(['', 'true'])(
      'tries to remove container only if build has started = %s',
      async buildStarted => {
        jest.spyOn(core, 'getState').mockReturnValueOnce(buildStarted)
        await actions.cleanup()
        expect(removeContainer).toHaveBeenCalledTimes(buildStarted ? 1 : 0)
      }
    )
  })
})
