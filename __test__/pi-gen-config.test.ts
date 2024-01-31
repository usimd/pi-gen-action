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
    ['imgName', '', 'image-name must not be empty'],
    [
      'release',
      'foo',
      'release must be one of ["bookworm", "bullseye", "jessie", "stretch", "buster", "testing"]'
    ],
    [
      'deployCompression',
      'bzip2',
      'compression must be one of ["none", "zip", "gz", "xz"]'
    ],
    [
      'compressionLevel',
      '15',
      'compression-level must be between 0 and 9 (or 9e for xz)'
    ],
    [
      'localeDefault',
      'en_DE.UTF-42',
      'locale is not included in the list of supported locales (retrieved from /usr/share/i18n/SUPPORTED)'
    ],
    ['targetHostname', undefined, 'hostname must not be empty'],
    ['keyboardKeymap', '', 'keyboard-keymap must not be empty'],
    ['keyboardLayout', undefined, 'keyboard-layout must not be empty'],
    [
      'timezoneDefault',
      'Europe/Munich',
      'timezone is not included in output of "timedatectl list-timezones"'
    ],
    ['firstUserName', '', 'username must not be empty'],
    [
      'wpaEssid',
      '0'.repeat(33),
      'wpa-essid must not be longer than 32 characters'
    ],
    [
      'wpaPassword',
      '12345',
      'wpa-password must be between 8 and 63 characters (or unset)'
    ],
    [
      'wpaPassword',
      '0'.repeat(64),
      'wpa-password must be between 8 and 63 characters (or unset)'
    ],
    ['setfcap', '0', 'setfcap should only be set to "1", nothing else'],
    ['stageList', [], 'stage-list must not be empty'],
    [
      'stageList',
      ['foo'],
      'stage-list must contain valid pi-gen stage names "stage[0-5]" and/or valid directories'
    ],
    [
      'stageList',
      [tmp.fileSync().name],
      'stage-list must contain valid pi-gen stage names "stage[0-5]" and/or valid directories'
    ],
    [
      'enableNoobs',
      'yes',
      'enable-noobs must be either set to "true" or "false", was: yes'
    ],
    [
      'exportLastStageOnly',
      'no',
      'export-last-stage-only must be either set to "true" or "false", was: no'
    ]
  ])(
    'rejects %s with invalid value %s',
    async (property: string, value: any, error: string) => {
      const piGenConfig = {
        ...DEFAULT_CONFIG,
        stageList: ['stage0', 'stage1', 'stage2']
      }
      expect(await validateConfig(piGenConfig)).toBeUndefined()

      piGenConfig[property as keyof PiGenConfig] = value
      expect(async () => await validateConfig(piGenConfig)).rejects.toThrow(
        error
      )
    }
  )

  it('should work with compressionLevel properly', async () => {
    const piGenConfig = {
      ...DEFAULT_CONFIG,
      stageList: ['stage0', 'stage1', 'stage2'],
      deployCompression: 'xz',
      compressionLevel: '9e'
    }

    expect(await validateConfig(piGenConfig)).toBeUndefined()
    for (const deployCompression of ['none', 'zip', 'gz']) {
      piGenConfig.deployCompression = deployCompression
      await expect(
        async () => await validateConfig(piGenConfig)
      ).rejects.toThrow(
        'compression-level must be between 0 and 9 (or 9e for xz)'
      )
    }
  })
})
