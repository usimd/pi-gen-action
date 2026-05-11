import * as core from '@actions/core'
import {DEFAULT_CONFIG} from '../src/pi-gen-config.js'
import * as actions from '../src/actions.js'
import {removeContainer} from '../src/remove-container.js'
import {build} from '../src/build.js'
import {removeRunnerComponents} from '../src/increase-runner-disk-size.js'

vi.mock('@actions/core', async importOriginal => {
  return {...(await importOriginal<typeof import('@actions/core')>())}
})
vi.mock('../src/configure.js', () => ({
  configure: vi.fn().mockReturnValue(DEFAULT_CONFIG)
}))
vi.mock('../src/install-dependencies.js')
vi.mock('../src/build.js')
vi.mock('../src/clone-pigen.js')
vi.mock('../src/remove-container.js')
vi.mock('../src/increase-runner-disk-size.js')

describe('Actions', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {...OLD_ENV}
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('should only increase disk space if requested', async () => {
    vi.spyOn(core, 'getBooleanInput').mockReturnValueOnce(true)

    await actions.piGen()

    expect(removeRunnerComponents).toHaveBeenCalled()
  })

  it('does not run build function twice but invokes cleanup', async () => {
    vi.spyOn(core, 'getState')
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
      vi.spyOn(core, 'getInput').mockImplementation((name, options) => {
        throw error
      })
      vi.spyOn(core, 'setFailed')

      await expect(actions.piGen()).resolves.not.toThrow()
      expect(core.setFailed).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  it.each([new Error(errorMessage), errorMessage])(
    'should gracefully catch errors thrown during cleanup and emit a warning message',
    async error => {
      vi.spyOn(core, 'getState').mockImplementation(name => {
        throw error
      })
      vi.spyOn(core, 'warning')

      await expect(actions.cleanup()).resolves.not.toThrow()
      expect(core.warning).toHaveBeenLastCalledWith(errorMessage)
    }
  )

  describe('cleanup', () => {
    it.each(['', 'true'])(
      'tries to remove container only if build has started = %s',
      async buildStarted => {
        vi.spyOn(core, 'getState').mockReturnValueOnce(buildStarted)
        await actions.cleanup()
        expect(removeContainer).toHaveBeenCalledTimes(buildStarted ? 1 : 0)
      }
    )
  })
})
