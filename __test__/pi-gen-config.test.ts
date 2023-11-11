import {
  PiGenConfig,
  writeToFile,
  DEFAULT_CONFIG,
  validateConfig
} from '../src/pi-gen-config'
import fs from 'fs/promises'
import * as path from 'path'
import * as tmp from 'tmp'

describe('PiGenConfig', () => {
  it('instance should write config to file', async () => {
    const imageName = 'foo'
    let config = {} as PiGenConfig
    config.imgName = imageName
    config.firstUserName = 'test'
    config.stageList = ['stage0', 'stage1']

    jest.spyOn(fs, 'writeFile').mockImplementation(() => Promise.resolve())
    jest
      .spyOn(fs, 'realpath')
      .mockImplementation(p =>
        Promise.resolve(`/pi-gen/${path.basename(p.toString())}`)
      )

    const fileName = 'test-file'
    await writeToFile(config, 'pi-gen', fileName)

    expect(fs.writeFile).toHaveBeenCalledWith(
      fileName,
      expect.stringMatching(
        new RegExp(
          `^(?=.*IMG_NAME="${imageName}"$)(?=.*STAGE_LIST="/pi-gen/stage0 /pi-gen/stage1"$)(?=.*FIRST_USER_NAME="test"$).*`,
          'sm'
        )
      )
    )
  })

  it('skips undefined config values when writing to file', async () => {
    jest.spyOn(fs, 'writeFile').mockImplementation(() => Promise.resolve())
    jest
      .spyOn(fs, 'realpath')
      .mockImplementation(p =>
        Promise.resolve(`/pi-gen/${path.basename(p.toString())}`)
      )

    const fileName = 'test-file'
    await writeToFile(DEFAULT_CONFIG, 'pi-gen', fileName)

    expect(fs.writeFile).toHaveBeenCalledWith(
      fileName,
      expect.stringMatching(
        new RegExp(
          `^(?!.*APT_PROXY="[^"]*"$)(?!.*FIRST_USER_PASS="[^"]*"$)(?!.*WPA_ESSID="[^"]*"$)(?!.*WPA_PASSWORD="[^"]*"$)(?!.*WPA_COUNTRY="[^"]*"$).*`,
          'sm'
        )
      )
    )
  })

  it.each([
    ['imgName', ''],
    ['release', 'foo'],
    ['deployCompression', 'bzip2'],
    ['compressionLevel', '15'],
    ['localeDefault', 'en_DE.UTF-42'],
    ['targetHostname', undefined],
    ['keyboardKeymap', ''],
    ['keyboardLayout', undefined],
    ['timezoneDefault', 'Europe/Munich'],
    ['firstUserName', ''],
    ['wpaEssid', '0'.repeat(33)],
    ['wpaPassword', '12345'],
    ['wpaPassword', '0'.repeat(64)],
    ['setfcap', '0'],
    ['stageList', []],
    ['stageList', ['foo']],
    ['stageList', [tmp.fileSync().name]],
    ['enableNoobs', 'yes'],
    ['exportLastStageOnly', 'no']
  ])(
    'rejects %s with invalid value %s',
    async (property: string, value: any) => {
      const piGenConfig = {...DEFAULT_CONFIG}
      piGenConfig[property as keyof PiGenConfig] = value
      await expect(
        async () => await validateConfig(piGenConfig)
      ).rejects.toThrow()
    }
  )
})
