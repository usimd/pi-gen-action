import * as core from '@actions/core'
import * as github from '@actions/github'
import {Git} from './git'

export async function clonePigen(
  repo: string,
  piGenDirectory: string,
  ref: string
): Promise<void> {
  try {
    const originalPiGenRepo = 'RPi-Distro/pi-gen'

    core.startGroup('Cloning pi-gen repository')
    const token = core.getInput('github-token')

    const octokit = github.getOctokit(token)
    const [owner, repoName] = repo.split('/')
    const repoInfo = await octokit.rest.repos.get({
      owner: owner,
      repo: repoName
    })

    core.debug(`Checking out ref ${ref} into ${piGenDirectory}`)
    const verbose = core.getBooleanInput('verbose-output')
    const git = await Git.getInstance(piGenDirectory, token, verbose)
    await git.clone(`https://github.com/${repo}`, ref)
  } finally {
    core.endGroup()
  }
}
