import {
  PiGenConfig,
  DEFAULT_CONFIG,
  writeToFile,
  loadFromFile
} from '../src/pi-gen-config'
import {writeFile, readFile} from 'fs/promises'

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn((file: string, options: object) => {})
}))

describe('PiGenConfig', () => {
  it('instance should write config to file', async () => {
    const imageName = 'foo'
    let config = {} as PiGenConfig
    config.imgName = imageName
    config.firstUserName = 'test'
    config.stageList = 'stage0 stage1'

    let fileName = 'test-file'
    await writeToFile(config, fileName)
    expect(writeFile).toHaveBeenCalledWith(
      fileName,
      expect.stringMatching(
        new RegExp(
          `^(?=.*IMG_NAME="${imageName}"$)(?=.*STAGE_LIST="stage0 stage1"$)(?=.*FIRST_USER_NAME="test"$).*`,
          'sm'
        )
      )
    )
  })

  it('instance loads values correctly from file', async () => {
    ;(readFile as jest.Mock).mockImplementationOnce(async () =>
      Promise.resolve('IMG_NAME="test"\nCOMPRESSION_LEVEL="8"')
    )
    const piGen = await loadFromFile('any')

    expect(piGen).toMatchObject({imgName: 'test', compressionLevel: '8'})
  })
})
