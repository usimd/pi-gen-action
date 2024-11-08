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
})
