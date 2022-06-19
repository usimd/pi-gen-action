import * as core from '@actions/core'
import {clonePigen} from '../src/clone-pigen'
import {Git} from '../src/git'
import {mock} from 'jest-mock-extended'

describe('Cloning pi-gen repo', () => {
  it('fetches pi-gen repository', async () => {
    const verbose = true
    const token = '123456'
    const ref = 'main'
    const targetDir = 'pi-gen-dir'
    const gitMock = mock<Git>()
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(verbose)
    jest.spyOn(core, 'getInput').mockReturnValue(token)
    Git.getInstance = jest.fn().mockResolvedValue(gitMock)

    await clonePigen(targetDir, ref)

    expect(Git.getInstance).toBeCalledWith(targetDir, token, verbose)
    expect(gitMock.clone).toBeCalledWith(
      'https://github.com/RPi-Distro/pi-gen',
      ref
    )
  })
})
