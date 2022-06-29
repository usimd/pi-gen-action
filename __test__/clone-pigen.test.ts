import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {clonePigen} from '../src/clone-pigen'
import {Git} from '../src/git'
import {mock, mockDeep} from 'jest-mock-extended'

describe('Cloning pi-gen repo', () => {
  it.each([
    ['RPi-Distro/pi-gen', false, true],
    ['owner/forked-repo', true, true],
    ['another-owner/no-fork', false, false]
  ])('fetches pi-gen repository %s', async (repo, isFork, succeed) => {
    const verbose = true
    const token = '123456'
    const ref = 'main'
    const targetDir = 'pi-gen-dir'
    const gitMock = mock<Git>()
    const githubMock = mockDeep<InstanceType<typeof GitHub>>()
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(verbose)
    jest.spyOn(core, 'getInput').mockReturnValue(token)
    jest.spyOn(github, 'getOctokit').mockReturnValueOnce(githubMock)
    Git.getInstance = jest.fn().mockResolvedValue(gitMock)
    githubMock.rest.repos.get.mockResolvedValueOnce({
      data: {
        fork: isFork,
        source: {full_name: isFork ? 'RPi-Distro/pi-gen' : repo}
      }
    } as any)

    const clone = clonePigen(repo, targetDir, ref)

    if (!succeed) {
      await expect(clone).rejects.toThrowError()
    } else {
      await expect(clone).resolves.not.toThrowError()
    }

    expect(githubMock.rest.repos.get).toBeCalledWith({
      owner: repo.split('/')[0],
      repo: repo.split('/')[1]
    })

    if (succeed) {
      expect(Git.getInstance).toBeCalledWith(targetDir, token, verbose)
      expect(gitMock.clone).toBeCalledWith(`https://github.com/${repo}`, ref)
    }
  })
})
