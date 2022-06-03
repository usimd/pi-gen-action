import {PiGenConfig, writeToFile, loadFromFile} from '../src/pi-gen-config'
import fs from 'fs/promises'
import * as path from 'path'

describe('PiGenConfig', () => {
  it('instance should write config to file', async () => {
    const imageName = 'foo'
    let config = {} as PiGenConfig
    config.imgName = imageName
    config.firstUserName = 'test'
    config.stageList = 'stage0 stage1'

    jest.spyOn(fs, 'writeFile').mockImplementation(() => Promise.resolve())
    jest
      .spyOn(fs, 'realpath')
      .mockImplementation(p =>
        Promise.resolve(`/pi-gen/${path.basename(p.toString())}`)
      )

    let fileName = 'test-file'
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

  it('instance loads values correctly from file', async () => {
    jest
      .spyOn(fs, 'readFile')
      .mockImplementationOnce(() =>
        Promise.resolve('IMG_NAME="test"\nCOMPRESSION_LEVEL="8"')
      )
    const piGen = await loadFromFile('any')

    expect(piGen).toMatchObject({imgName: 'test', compressionLevel: '8'})
  })
})
