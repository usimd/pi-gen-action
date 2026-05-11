import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {build} from '../src/build.js'
import {PiGen} from '../src/pi-gen.js'
import {mock} from 'vitest-mock-extended'
import {DEFAULT_CONFIG} from '../src/pi-gen-config.js'

vi.mock('@actions/exec')
vi.mock('@actions/core', () => ({
  getBooleanInput: vi.fn().mockReturnValue(true),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  setOutput: vi.fn()
}))

describe('Run pi-gen build', () => {
  it('throws error if no exports configured', async () => {
    const piGenMock = mock<PiGen>()
    piGenMock.hasExportsConfigured.mockResolvedValueOnce(false)
    vi.spyOn(PiGen, 'getInstance').mockResolvedValue(piGenMock)

    await expect(
      async () => await build('pi-gen', DEFAULT_CONFIG)
    ).rejects.toThrow()
  })

  it('throws error if pi-gen build yields failed result', async () => {
    const exitCode = 666
    const piGenMock = mock<PiGen>()
    piGenMock.hasExportsConfigured.mockResolvedValueOnce(true)
    piGenMock.build.mockResolvedValue({
      exitCode: exitCode,
      stderr: ['fail1', 'fail2'].join('\n')
    } as exec.ExecOutput)
    vi.spyOn(PiGen, 'getInstance').mockResolvedValue(piGenMock)

    await expect(
      async () => await build('pi-gen', DEFAULT_CONFIG)
    ).rejects.toMatchObject(
      expect.objectContaining({
        message: expect.stringContaining(exitCode.toString())
      })
    )
  })

  it('sets output variables to image paths', async () => {
    const imagePath = '/image-path.img'
    const noobsPath = '/noobs-path'
    const piGenMock = mock<PiGen>()
    piGenMock.hasExportsConfigured.mockResolvedValueOnce(true)
    piGenMock.build.mockResolvedValue({
      exitCode: 0
    } as exec.ExecOutput)
    piGenMock.getLastImagePath.mockResolvedValueOnce(imagePath)
    piGenMock.getLastNoobsImagePath.mockResolvedValueOnce(noobsPath)
    vi.spyOn(PiGen, 'getInstance').mockResolvedValue(piGenMock)

    const conf = {...DEFAULT_CONFIG}
    conf.enableNoobs = 'true'
    await build('pi-gen', conf)
    expect(core.setOutput).toHaveBeenCalledTimes(2)
  })
})
