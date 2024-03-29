import {configure} from '../src/configure'
import * as config from '../src/pi-gen-config'
import * as core from '@actions/core'

describe('Configure', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {...OLD_ENV}
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('throws error if no image name present', async () => {
    await expect(async () => await configure()).rejects.toThrow()
  })

  it('creates a stage array from user config', async () => {
    jest.spyOn(config, 'validateConfig').mockReturnValue(Promise.resolve())
    process.env['INPUT_IMAGE-NAME'] = 'test'
    process.env['INPUT_STAGE-LIST'] = 'stage0 stage1'
    process.env['INPUT_ENABLE-NOOBS'] = 'false'
    process.env['INPUT_EXPORT-LAST-STAGE-ONLY'] = 'true'

    expect(await configure()).toEqual(
      expect.objectContaining({
        imgName: 'test',
        stageList: ['stage0', 'stage1']
      })
    )
  })

  it('masks sensitive user input', async () => {
    jest.spyOn(core, 'info').mockImplementation()
    jest.spyOn(config, 'validateConfig').mockReturnValue(Promise.resolve())

    process.env['INPUT_IMAGE-NAME'] = 'test'
    process.env['INPUT_ENABLE-NOOBS'] = 'false'
    process.env['INPUT_EXPORT-LAST-STAGE-ONLY'] = 'true'
    process.env['INPUT_PASSWORD'] = 'secretpassword'
    process.env['INPUT_WPA-PASSWORD'] = 'secretpassword'

    await configure()

    expect(core.info).toHaveBeenCalledWith(
      expect.not.stringContaining('secretpassword')
    )
  })

  it('should fall back to default configuration values if no user settings present', async () => {
    jest.spyOn(core, 'info').mockImplementation()
    jest.spyOn(core, 'getInput').mockReturnValue('')
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(false)
    jest.spyOn(config, 'validateConfig').mockReturnValue(Promise.resolve())

    await configure()

    expect(config.validateConfig).toHaveBeenCalledWith(config.DEFAULT_CONFIG)
  })
})
