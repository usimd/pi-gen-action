import {Git} from '../src/git'
import * as exec from '@actions/exec'

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
})
