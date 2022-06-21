import * as core from '@actions/core'
import {DEFAULT_CONFIG} from '../src/pi-gen-config'
import * as actions from '../src/actions'
import {removeContainer} from '../src/remove-container'
import {build} from '../src/build'

jest.mock('../src/configure', () => ({
  configure: jest.fn().mockReturnValue(DEFAULT_CONFIG)
}))
jest.mock('../src/install-dependencies')
jest.mock('../src/build')
jest.mock('../src/clone-pigen')
jest.mock('../src/remove-container')

describe('Actions', () => {
  it('does not run build function twice but invokes cleanup', async () => {
    jest
      .spyOn(core, 'getState')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')

    // expect build here
    await actions.run()
    // expect cleanup here
    await actions.run()

    expect(build).toHaveBeenCalledTimes(1)
    expect(removeContainer).toHaveBeenCalledTimes(1)
  })

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
