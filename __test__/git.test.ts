import {Git} from '../src/git'
import * as exec from '@actions/exec'
import * as fs from 'fs'

describe('Git', () => {
  it.each([
    ['master', true],
    ['non-existing-branch', false]
  ])('determines correctly if branch %s exists', async (branchName, exists) => {
    const git = await Git.getInstance('.', '', false)

    expect(await git.branchExists(branchName)).toBe(exists)
  })

  it.each([
    ['v1', true],
    ['vFOOBAR', false]
  ])('determines correctly if tag %s exists', async (tagName, exists) => {
    const git = await Git.getInstance('.', '', true)

    expect(await git.tagExists(tagName)).toBe(exists)
  })

  it('throws error with Git error message', async () => {
    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 1,
      stderr: 'this failed'
    } as exec.ExecOutput)

    await expect(
      async () => await Git.getInstance('.', '', false)
    ).rejects.toThrow('this failed')
  })

  it('configures authentication with given token', async () => {
    const token = '1234567890'
    jest
      .spyOn(exec, 'getExecOutput')
      .mockImplementation(
        async commandLine => ({exitCode: 0}) as exec.ExecOutput
      )
    jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValueOnce('AUTHORIZATION: basic ***')
    jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    await Git.getInstance('.', token)

    expect(exec.getExecOutput).toBeCalledWith(
      expect.stringMatching(/git$/),
      [
        'config',
        '--local',
        'http.https://github.com/.extraheader',
        'AUTHORIZATION: basic ***'
      ],
      expect.anything()
    )
    expect(fs.promises.writeFile).toBeCalledWith(
      expect.stringMatching(new RegExp('.git/config$')),
      'AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46MTIzNDU2Nzg5MA=='
    )
  })

  it.each([
    ['v1', true],
    ['arm64', false]
  ])(
    'clones correct ref %s with verbose enabled = %s',
    async (refName, verbose) => {
      const repoName = 'https://github.com/test/repo'
      jest.spyOn(exec, 'getExecOutput').mockImplementation(
        async (commandLine, args) =>
          ({
            exitCode: 0,
            stdout:
              refName === 'v1' &&
              ['tag', '--list'].every(a => args?.includes(a))
                ? 'v1'
                : ['branch', '--list'].every(a => args?.includes(a))
                ? 'arm64'
                : ''
          }) as exec.ExecOutput
      )

      const git = await Git.getInstance('.', '', verbose)
      await git.clone(repoName, refName)

      let expectedCheckout = ['checkout', '--force']

      if (verbose) {
        expectedCheckout.push('--progress')
      }

      if (refName === 'v1') {
        expectedCheckout.push(refName)
      } else {
        expectedCheckout.push('-B', refName, `refs/remotes/origin/${refName}`)
      }

      expect(exec.getExecOutput).toHaveBeenLastCalledWith(
        expect.stringMatching(/git$/),
        expectedCheckout,
        expect.anything()
      )
    }
  )

  it('throws error on unknown ref', async () => {
    jest
      .spyOn(exec, 'getExecOutput')
      .mockImplementation(
        async commandLine => ({exitCode: 0, stdout: ''}) as exec.ExecOutput
      )

    const git = await Git.getInstance('.', '')
    await expect(
      async () => await git.clone('any-repo', 'non-existing-ref')
    ).rejects.toThrowError()
  })
})
