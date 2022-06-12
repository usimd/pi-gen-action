import {PiGen} from '../src/pi-gen'
import fs, {Dirent} from 'fs'
import {DEFAULT_CONFIG, PiGenConfig} from '../src/pi-gen-config'
import {PiGenStages} from '../src/pi-gen-stages'
import * as exec from '@actions/exec'

jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn().mockResolvedValue({exitCode: 0} as exec.ExecOutput)
}))

jest.mock('../src/pi-gen-config', () => ({
  writeToFile: jest.fn()
}))

describe('PiGen', () => {
  it('should fail on no-dir pi-gen path', async () => {
    jest
      .spyOn(fs, 'statSync')
      .mockReturnValue({isDirectory: () => false} as fs.Stats)

    expect(() => new PiGen('pi-gen-dir', DEFAULT_CONFIG)).toThrowError()
  })

  it('should fail on missing entries at pi-gen path', async () => {
    jest
      .spyOn(fs, 'statSync')
      .mockReturnValue({isDirectory: () => true} as fs.Stats)
    jest
      .spyOn(fs, 'readdirSync')
      .mockReturnValue([
        {name: 'Dockerfile', isFile: () => true} as Dirent,
        {name: 'stage0', isDirectory: () => true} as Dirent
      ])

    expect(() => new PiGen('pi-gen-dir', DEFAULT_CONFIG)).toThrowError()
  })

  it('mounts all stage paths as Docker volumes', async () => {
    const piGenDir = 'pi-gen'

    jest
      .spyOn(fs, 'statSync')
      .mockReturnValue({isDirectory: () => true} as fs.Stats)
    jest.spyOn(fs, 'readdirSync').mockReturnValue([
      {
        name: 'Dockerfile',
        isFile: () => true,
        isDirectory: () => false
      } as Dirent,
      {
        name: 'build-docker.sh',
        isFile: () => true,
        isDirectory: () => false
      } as Dirent,
      ...(Object.values(PiGenStages).map(stage => ({
        name: stage,
        isDirectory: () => true,
        isFile: () => false
      })) as Dirent[])
    ])
    jest
      .spyOn(fs, 'realpathSync')
      .mockReturnValueOnce(`/${piGenDir}`)
      .mockReturnValueOnce('/any/stage/path')
      .mockReturnValueOnce('/pi-gen/stage0')
    jest.spyOn(fs, 'writeFileSync').mockReturnValue()

    const piGen = new PiGen(piGenDir, {
      stageList: '/any/stage/path /pi-gen/stage0'
    } as PiGenConfig)
    await piGen.build()

    expect(exec.getExecOutput).toBeCalledWith(
      '"./build-docker.sh"',
      ['-c', `/${piGenDir}/config`],
      expect.objectContaining({
        cwd: piGenDir,
        env: {
          PIGEN_DOCKER_OPTS:
            '-v /any/stage/path:/any/stage/path -v /pi-gen/stage0:/pi-gen/stage0'
        }
      })
    )
  })
})
