import {PiGen} from '../src/pi-gen'
import fs, {Dirent} from 'fs'
import {DEFAULT_CONFIG, PiGenConfig} from '../src/pi-gen-config'
import {PiGenStages} from '../src/pi-gen-stages'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'

jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn().mockResolvedValue({exitCode: 0} as exec.ExecOutput)
}))

jest.mock('../src/pi-gen-config', () => ({
  writeToFile: jest.fn()
}))

const mockPiGenDependencies = () => {
  jest
    .spyOn(fs.promises, 'stat')
    .mockResolvedValueOnce({isDirectory: () => true} as fs.Stats)

  jest.spyOn(fs.promises, 'readdir').mockResolvedValueOnce([
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
}

describe('PiGen', () => {
  it('should fail on no-dir pi-gen path', async () => {
    jest
      .spyOn(fs.promises, 'stat')
      .mockResolvedValue({isDirectory: () => false} as fs.Stats)

    await expect(
      async () => await PiGen.getInstance('pi-gen-dir', DEFAULT_CONFIG)
    ).rejects.toThrowError()
  })

  it('should fail on missing entries at pi-gen path', async () => {
    jest
      .spyOn(fs.promises, 'stat')
      .mockResolvedValue({isDirectory: () => true} as fs.Stats)
    jest.spyOn(fs.promises, 'readdir').mockResolvedValue([
      {
        name: 'Dockerfile',
        isFile: () => true,
        isDirectory: () => false
      } as Dirent,
      {name: 'stage0', isDirectory: () => true, isFile: () => false} as Dirent
    ])

    await expect(
      async () => await PiGen.getInstance('pi-gen-dir', DEFAULT_CONFIG)
    ).rejects.toThrowError()
  })

  it('mounts all stage paths as Docker volumes', async () => {
    const piGenDir = 'pi-gen'
    mockPiGenDependencies()
    jest
      .spyOn(fs, 'realpathSync')
      .mockReturnValueOnce(`/${piGenDir}`)
      .mockReturnValueOnce('/any/stage/path')
      .mockReturnValueOnce('/pi-gen/stage0')

    const piGen = await PiGen.getInstance(piGenDir, {
      stageList: ['/any/stage/path', '/pi-gen/stage0']
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

  it('finds no exported images', async () => {
    const piGenDir = 'pi-gen'
    mockPiGenDependencies()
    jest.spyOn(fs, 'realpathSync').mockReturnValueOnce(`/${piGenDir}`)
    jest.spyOn(glob, 'create').mockResolvedValue({
      glob: () => Promise.resolve([] as string[])
    } as glob.Globber)

    const piGen = await PiGen.getInstance(piGenDir, {
      stageList: ['/pi-gen/stage0', '/pi-gen-stage1']
    } as PiGenConfig)

    expect(await piGen.hasExportsConfigured()).toBeFalsy()
    expect(glob.create).toHaveBeenCalledWith('/pi-gen/stage0/EXPORT_*')
  })
})
