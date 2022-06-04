import {PiGen} from '../src/pi-gen'
import fs, {Dirent} from 'fs'
import {PiGenConfig} from '../src/pi-gen-config'
import {PiGenStages} from '../src/pi-gen-stages'
import * as exec from '@actions/exec'

jest.mock('@actions/exec', () => ({
  exec: jest.fn()
}))

jest.mock('../src/pi-gen-config', () => ({
  loadFromFile: jest
    .fn()
    .mockResolvedValue({
      stageList: '/any/stage/path /pi-gen/stage0'
    } as PiGenConfig)
}))

describe('PiGen', () => {
  it('should fail on no-dir pi-gen path', async () => {
    jest
      .spyOn(fs, 'statSync')
      .mockReturnValue({isDirectory: () => false} as fs.Stats)

    expect(() => new PiGen('pi-gen-dir', 'pi-gen-dir/config')).toThrowError()
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

    expect(() => new PiGen('pi-gen-dir', 'pi-gen-dir/config')).toThrowError()
  })

  it('mounts all stage paths as Docker volumes', async () => {
    jest
      .spyOn(fs, 'statSync')
      .mockReturnValue({isDirectory: () => true} as fs.Stats)
    jest
      .spyOn(fs, 'readdirSync')
      .mockReturnValue([
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
      .mockReturnValueOnce('/pi-gen/config')
      .mockReturnValueOnce('/any/stage/path')
      .mockReturnValueOnce('/pi-gen/stage0')

    const piGen = new PiGen('pi-gen-dir', 'pi-gen-dir/config')
    await piGen.build()

    expect(exec.exec).toBeCalledWith(
      '"./build-docker.sh"',
      ['-c', '/pi-gen/config'],
      {
        cwd: 'pi-gen-dir',
        env: {
          PIGEN_DOCKER_OPTS:
            '-v "/any/stage/path:/any/stage/path" -v "/pi-gen/stage0:/pi-gen/stage0"'
        }
      }
    )
  })
})
