import {PiGen} from '../src/pi-gen'
import fs, {Dirent} from 'fs'
import {DEFAULT_CONFIG, PiGenConfig} from '../src/pi-gen-config'
import {PiGenStages} from '../src/pi-gen-stages'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'
import * as core from '@actions/core'
import * as tmp from 'tmp'

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

  jest.spyOn(fs, 'realpathSync').mockImplementationOnce(p => `/${p.toString()}`)
}

describe('PiGen', () => {
  it.each(['invalid-pi-gen-path', tmp.fileSync().name])(
    'should fail on invalid pi-gen path',
    async piGenPath => {
      await expect(
        async () => await PiGen.getInstance(piGenPath, DEFAULT_CONFIG)
      ).rejects.toThrowError()
    }
  )

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
      .mockReturnValueOnce('/any/stage/path')
      .mockReturnValueOnce('/pi-gen/stage0')

    const piGen = await PiGen.getInstance(piGenDir, {
      stageList: ['/any/stage/path', '/pi-gen/stage0'],
      dockerOpts: ''
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

  it('passes custom docker opts', async () => {
    const piGenDir = 'pi-gen'
    mockPiGenDependencies()
    jest
      .spyOn(fs, 'realpathSync')
      .mockReturnValueOnce('/pi-gen/stage0')

    const piGen = await PiGen.getInstance(piGenDir, {
      stageList: ['/pi-gen/stage0'],
      dockerOpts: '-v /foo:/bar'
    } as PiGenConfig)
    await piGen.build()

    expect(exec.getExecOutput).toBeCalledWith(
      '"./build-docker.sh"',
      ['-c', `/${piGenDir}/config`],
      expect.objectContaining({
        cwd: piGenDir,
        env: {
          PIGEN_DOCKER_OPTS: '-v /pi-gen/stage0:/pi-gen/stage0 -v /foo:/bar'
        }
      })
    )
  })

  it('finds no exported images', async () => {
    const piGenDir = 'pi-gen'
    mockPiGenDependencies()
    jest.spyOn(glob, 'create').mockResolvedValue({
      glob: () => Promise.resolve([] as string[])
    } as glob.Globber)

    const piGen = await PiGen.getInstance(piGenDir, {
      stageList: ['/pi-gen/stage0', '/pi-gen-stage1']
    } as PiGenConfig)

    expect(await piGen.hasExportsConfigured()).toBeFalsy()
    expect(glob.create).toHaveBeenCalledWith('/pi-gen/stage0/EXPORT_*')
  })

  it('throws an error when configuring empty stage list', async () => {
    await expect(
      async () =>
        await PiGen.getInstance('', {stageList: [] as string[]} as PiGenConfig)
    ).rejects.toThrowError()
  })

  it('configures NOOBS export for stages that export images', async () => {
    let stageList = [tmp.dirSync().name, tmp.dirSync().name]
    fs.writeFileSync(`${stageList[0]}/EXPORT_IMAGE`, '')

    await PiGen.getInstance('', {
      stageList: stageList,
      enableNoobs: 'true'
    } as PiGenConfig)

    expect(fs.existsSync(`${stageList[0]}/EXPORT_NOOBS`)).toBeTruthy()
    expect(fs.existsSync(`${stageList[1]}/EXPORT_NOOBS`)).toBeFalsy()
  })

  it.each([
    [
      false,
      [
        (() => {
          let stageDir = tmp.dirSync().name
          fs.writeFileSync(`${stageDir}/EXPORT_IMAGE`, '')
          fs.writeFileSync(`${stageDir}/EXPORT_NOOBS`, '')
          return stageDir
        })(),
        tmp.dirSync().name
      ]
    ],
    [true, [tmp.dirSync().name, tmp.dirSync().name]]
  ])(
    'configures stages correctly when only last one exported and NOOBS = %s',
    async (noobsEnabled, stageList) => {
      mockPiGenDependencies()
      await PiGen.getInstance('', {
        stageList: stageList,
        exportLastStageOnly: 'true',
        enableNoobs: noobsEnabled.toString()
      } as PiGenConfig)

      expect(fs.existsSync(`${stageList[0]}/EXPORT_NOOBS`)).toBeFalsy()
      expect(fs.existsSync(`${stageList[0]}/EXPORT_IMAGE`)).toBeFalsy()
      expect(fs.existsSync(`${stageList[1]}/EXPORT_NOOBS`)).toBe(noobsEnabled)
      expect(fs.existsSync(`${stageList[1]}/EXPORT_IMAGE`)).toBeTruthy()
    }
  )

  it.each([
    [false, 'no stage message', 'info', 0],
    [true, 'no stage message', 'info', 1],
    [false, '[00:00:00] stage message', 'info', 1],
    [true, 'warning message', 'warning', 1]
  ])(
    'handles log messages if verbose = %s',
    (verbose, line, stream, nCalls) => {
      jest.spyOn(core, 'info').mockImplementation(s => {})
      jest.spyOn(core, 'warning').mockImplementation(s => {})
      mockPiGenDependencies()

      const piGenSut = new PiGen('pi-gen', DEFAULT_CONFIG)
      piGenSut.logOutput(line, verbose, stream as 'info' | 'warning')

      expect(
        stream === 'info' ? core.info : core.warning
      ).toHaveBeenCalledTimes(nCalls)
    }
  )

  it.each([
    ['none', [] as string[], undefined],
    ['xz', ['foo.img.xz', 'bar.img.xz'], 'foo.img.xz']
  ])(
    'resolves path to created image',
    async (compressionType, globResults, expectedResult) => {
      mockPiGenDependencies()
      jest
        .spyOn(glob, 'create')
        .mockResolvedValue({glob: async () => globResults} as glob.Globber)

      const piGen = await PiGen.getInstance('pi-gen-dir', {
        deployCompression: compressionType,
        stageList: ['stage0']
      } as PiGenConfig)

      expect(await piGen.getLastImagePath()).toBe(expectedResult)
      expect(glob.create).toHaveBeenLastCalledWith(
        `pi-gen-dir/deploy/*.${
          compressionType == 'none' ? 'img' : compressionType
        }`,
        expect.anything()
      )
    }
  )

  it.each([
    ['foo', [] as string[], undefined],
    [
      'bar',
      [
        '/pi-gen-dir/deploy/bar-lite/os.json',
        '/pi-gen-dir/deploy/bar-full/os.json'
      ],
      '/pi-gen-dir/deploy/bar-lite'
    ]
  ])(
    'resolves path to created NOOBS directory',
    async (imageName, globResults, expectedResult) => {
      mockPiGenDependencies()
      jest
        .spyOn(glob, 'create')
        .mockResolvedValue({glob: async () => globResults} as glob.Globber)

      const piGen = await PiGen.getInstance('pi-gen-dir', {
        imgName: imageName,
        stageList: ['stage0']
      } as PiGenConfig)

      expect(await piGen.getLastNoobsImagePath()).toBe(expectedResult)
      expect(glob.create).toHaveBeenLastCalledWith(
        `pi-gen-dir/deploy/${imageName}*/os.json`
      )
    }
  )
})
