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

const mockPiGenDependencies = (
  stageDirectories = Object.values(PiGenStages),
  buildFiles = ['build-docker.sh', 'Dockerfile']
) => {
  jest
    .spyOn(fs.promises, 'stat')
    .mockResolvedValueOnce({isDirectory: () => true} as fs.Stats)

  jest.spyOn(fs.promises, 'readdir').mockResolvedValueOnce([
    ...buildFiles.map(
      fileName =>
        ({
          name: fileName,
          isFile: () => true,
          isDirectory: () => false
        }) as Dirent<any>
    ),
    ...stageDirectories.map(
      stage =>
        ({
          name: stage,
          isDirectory: () => true,
          isFile: () => false
        }) as Dirent<any>
    )
  ])

  jest.spyOn(fs, 'realpathSync').mockImplementationOnce(p => `/${p.toString()}`)
}

describe('PiGen', () => {
  it.each(['invalid-pi-gen-path', tmp.fileSync().name])(
    'should fail on invalid pi-gen path = %s',
    async piGenPath => {
      await expect(
        async () => await PiGen.getInstance(piGenPath, DEFAULT_CONFIG)
      ).rejects.toThrow()
    }
  )

  it.each(['build-docker.sh', 'Dockerfile'])(
    'should fail if only pi-gen core build file %s is present and others missing',
    async buildFile => {
      mockPiGenDependencies(Object.values(PiGenStages), [buildFile])

      await expect(
        async () =>
          await PiGen.getInstance('pi-gen-dir', {
            ...DEFAULT_CONFIG,
            stageList: ['stage0']
          })
      ).rejects.toThrow()
    }
  )

  it('should fail on missing required stage entries at pi-gen path', async () => {
    mockPiGenDependencies(['stage0', 'stage1'])
    jest
      .spyOn(fs.promises, 'stat')
      .mockResolvedValue({isDirectory: () => true} as fs.Stats)

    await expect(
      async () =>
        await PiGen.getInstance('pi-gen-dir', {
          ...DEFAULT_CONFIG,
          stageList: ['stage0', 'stage1', 'stage2']
        })
    ).rejects.toThrow()
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

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      '"./build-docker.sh"',
      ['-c', `/${piGenDir}/config`],
      expect.objectContaining({
        cwd: piGenDir,
        env: expect.objectContaining({
          PIGEN_DOCKER_OPTS:
            '-v /any/stage/path:/any/stage/path -v /pi-gen/stage0:/pi-gen/stage0 -e DEBIAN_FRONTEND=noninteractive'
        })
      })
    )
  })

  it('passes custom docker opts', async () => {
    const piGenDir = 'pi-gen'
    mockPiGenDependencies()
    jest.spyOn(fs, 'realpathSync').mockReturnValueOnce('/pi-gen/stage0')

    const piGen = await PiGen.getInstance(piGenDir, {
      stageList: ['/pi-gen/stage0'],
      dockerOpts: '-v /foo:/bar'
    } as PiGenConfig)
    await piGen.build()

    expect(exec.getExecOutput).toHaveBeenCalledWith(
      '"./build-docker.sh"',
      ['-c', `/${piGenDir}/config`],
      expect.objectContaining({
        cwd: piGenDir,
        env: expect.objectContaining({
          PIGEN_DOCKER_OPTS:
            '-v /foo:/bar -v /pi-gen/stage0:/pi-gen/stage0 -e DEBIAN_FRONTEND=noninteractive'
        })
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
    ).rejects.toThrow()
  })

  it('configures NOOBS export for stages that export images', async () => {
    const piGenDir = 'pi-gen'
    mockPiGenDependencies()
    const stageList = [tmp.dirSync().name, tmp.dirSync().name]
    jest.spyOn(fs, 'realpathSync').mockReturnValueOnce('/pi-gen/stage0')

    fs.writeFileSync(`${stageList[0]}/EXPORT_IMAGE`, '')

    await PiGen.getInstance(piGenDir, {
      stageList: stageList,
      enableNoobs: 'true'
    } as PiGenConfig)

    expect(fs.existsSync(`${stageList[0]}/EXPORT_NOOBS`)).toBeTruthy()
    expect(fs.existsSync(`${stageList[1]}/EXPORT_NOOBS`)).toBeFalsy()
  })

  it('does not require a stage5 directory for Buster', async () => {
    const piGenDir = 'pi-gen'
    const busterStages = ['stage0', 'stage1', 'stage2', 'stage3', 'stage4']
    mockPiGenDependencies(busterStages)
    jest.spyOn(fs, 'realpathSync').mockReturnValueOnce('/pi-gen/stage0')
    // If user added a 'stage5', don't fail
    let config = {
      ...DEFAULT_CONFIG,
      release: 'buster',
      stageList: [...busterStages, 'stage5']
    } as PiGenConfig

    const pigen = PiGen.getInstance(piGenDir, config)

    await expect(pigen).resolves.not.toThrow()
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
    ['no stage message', false, 'info', 0],
    ['no stage message', true, 'info', 1],
    ['[00:00:00] stage message', false, 'info', 0],
    ['warning message', true, 'warning', 1],
    ['#6 [1/3] FROM docker.io', false, 'warning', 0],
    ['#7 [2/3] RUN', true, 'warning', 0],
    [' #6 [1/3] FROM docker.io', false, 'info', 0],
    ['   #7 [2/3] RUN', true, 'info', 1]
  ])(
    'handles log message "%s" correctly if verbose = %s',
    (line, verbose, stream, nCalls) => {
      jest.spyOn(core, 'info').mockImplementation(s => {})
      jest.spyOn(core, 'warning').mockImplementation(s => {})
      mockPiGenDependencies()

      const piGenSut = new PiGen('pi-gen', {
        ...DEFAULT_CONFIG,
        stageList: ['stage0']
      })
      piGenSut.logOutput(line, verbose, stream as 'info' | 'warning')

      expect(
        stream === 'info' ? core.info : core.warning
      ).toHaveBeenCalledTimes(nCalls)
    }
  )

  it.each([
    [['no stage message'], 0, 0, null],
    [['[00:00:00] Begin stage-name'], 1, 0, ['stage-name']],
    [['[00:00:00] End stage-name'], 0, 1, null]
  ])(
    'opens and closes log groups according to pi-gen status messages',
    (lines, startGroupCalls, endGroupCalls, startGroupValues) => {
      jest.spyOn(core, 'startGroup').mockImplementation(_ => {})
      jest.spyOn(core, 'endGroup').mockImplementation(() => null)
      mockPiGenDependencies()

      const piGenSut = new PiGen('pi-gen', {
        ...DEFAULT_CONFIG,
        stageList: ['stage0']
      })
      lines.forEach(line => piGenSut.logOutput(line, false, 'info'))

      if (startGroupCalls > 0) {
        expect(core.startGroup).toHaveBeenCalledTimes(startGroupCalls)
        startGroupValues?.forEach(groupName =>
          expect(core.startGroup).toHaveBeenCalledWith(groupName)
        )
      }

      if (endGroupCalls > 0) {
        expect(core.endGroup).toHaveBeenCalledTimes(endGroupCalls)
      }
    }
  )

  it('closes still open log groups if build crashes', async () => {
    jest.spyOn(fs, 'realpathSync').mockReturnValue('/pi-gen/stage0')
    jest.spyOn(core, 'endGroup')
    jest
      .spyOn(exec, 'getExecOutput')
      .mockImplementationOnce((cmdLine, args) =>
        Promise.resolve({} as exec.ExecOutput)
      )

    const piGen = new PiGen('', {...DEFAULT_CONFIG, stageList: ['stage0']})
    piGen.openLogGroups = 2
    await piGen.build()

    expect(core.endGroup).toHaveBeenCalledTimes(2)
  })

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
