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
      'timezone is not a valid time zone definition'
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
    ],
    [
      'enableSsh',
      'yes',
      'enable-ssh must be set to either "0" or "1" but was: yes'
    ],
    [
      'pubkeyOnlySsh',
      'yes',
      'pubkey-only-ssh must be set to either "0" or "1" but was: yes'
    ],
    [
      'pubkeySshFirstUser',
      'ssh-foo vnqf493rn34xzrm234yru13ß48rnz1x034ztn== foo@bar.com',
      'pubkey-ssh-first-user does not seem to be a valid list of public key according to "ssh-keygen -l", here\'s its output'
    ],
    [
      'aptProxy',
      'this/is/not/valid',
      'apt-proxy is not a valid URL. Make it point to a correct http/https address'
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
      await expect(
        async () => await validateConfig(piGenConfig)
      ).rejects.toThrow(error)
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

  it('should accept valid public key file', async () => {
    const piGenConfig = {
      ...DEFAULT_CONFIG,
      stageList: ['stage0', 'stage1', 'stage2'],
      pubkeySshFirstUser: `ecdsa-sha2-nistp521 AAAAE2VjZHNhLXNoYTItbmlzdHA1MjEAAAAIbmlzdHA1MjEAAACFBAF71eRtNA2CqGiKYQLI6ozVyW1XKJUXOqkH1r3ZWIruDvckuwxBUZYMvB5si4PkteJqKJnFsO74LesgxTvacxNELgHvxXCJ4XmuT0O7XujwrFCO6dARYyf+RUO5XKt0LegmbqMq3faE7SMmVJnl39quLWojGZ8kUUeS6rg089l7X9LxBA== foo@bar.com
        ssh-dss AAAAB3NzaC1kc3MAAAEBAI95Ndm5qum/q+2Ies9JUbbzLsWeO683GOjqxJYfPv02BudDUanEGDM5uAnnwq4cU5unR1uF0BGtuLR5h3VJhGlcrA6PFLM2CCiiL/onEQo9YqmTRTQJoP5pbEZY+EvdIIGcNwmgEFexla3NACM9ulSEtikfnWSO+INEhneXnOwEtDSmrC516Zhd4j2wKS/BEYyf+p2BgeczjbeStzDXueNJWS9oCZhyFTkV6j1ri0ZTxjNFj4A7MqTC4PJykCVuTj+KOwg4ocRQ5OGMGimjfd9eoUPeS2b/BJA+1c8WI+FY1IfGCOl/IRzYHcojy244B2X4IuNCvkhMBXY5OWAc1mcAAAAdALr2lqaFePff3uf6Z8l3x4XvMrIzuuWAwLzVaV0AAAEAFqZcWCBIUHBOdQKjl1cEDTTaOjR4wVTU5KXALSQu4E+W5h5L0JBKvayPN+6x4J8xgtI8kEPLZC+IAEFg7fnKCbMgdqecMqYn8kc+kYebosTnRL0ggVRMtVuALDaNH6g+1InpTg+gaI4yQopceMR4xo0FJ7ccmjq7CwvhLERoljnn08502xAaZaorh/ZMaCbbPscvS1WZg0u07bAvfJDppJbTpV1TW+v8RdT2GfY/Pe27hzklwvIk4HcxKW2oh+weR0j4fvtf3rdUhDFrIjLe5VPdrwIRKw0fAtowlzIk/ieu2oudSyki2bqL457Z4QOmPFKBC8aIt+LtQxbh7xfb3gAAAQAG2DjHpzzWGYtVLzMRfXwRFmVNwOO1Rg7ZmLjcy0hWy2b2JzeYJJSj+mRa/GC/Si3e16b0nBJGWU6FcTGSzPOdU3xrMJGLqtIlnUyqS5UJf75xs7zJamuSJ/QMLsvzqglaFBygL5Iuc5KF8lluXFK9h4ggCYxJp2UhgpsX6QMAl7ITeTHFdGWs/nwBHafEwxY3DViTmrj7wXuz8QBzzh65+lIrbOnibg3gliBg77bFLfVEFdylu3f5R18c8sZ9U0c4DOA+ZGlmAqSHZOQtyf8p8T+yKbMBJaQ/R+y0qG/R5Ai1d/aBcGZ1W5b/BU9Z+6yb7ITGowGzObBhU3L4g22e test@example.org`
    }

    expect(await validateConfig(piGenConfig)).toBeUndefined()
  })
})
