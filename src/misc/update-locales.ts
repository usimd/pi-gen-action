import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {gunzipSync} from 'zlib'

// "testing" is pinned to the Debian suite currently in testing
const RELEASES: Record<string, string> = {
  jessie: 'jessie',
  stretch: 'stretch',
  buster: 'buster',
  bullseye: 'bullseye',
  bookworm: 'bookworm',
  trixie: 'trixie',
  testing: 'forky'
}
const MIRRORS = [
  'https://deb.debian.org/debian',
  'https://archive.debian.org/debian'
]
const OUTPUT_FILE = 'dist/supported-locales.json'

async function download(url: string): Promise<Buffer | undefined> {
  const response = await fetch(url)
  if (response.status === 404) {
    return undefined
  }
  if (!response.ok) {
    throw new Error(`Downloading ${url} failed: HTTP ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function findLocalesPackage(
  suite: string
): Promise<{mirror: string; filename: string}> {
  for (const mirror of MIRRORS) {
    const packages = await download(
      `${mirror}/dists/${suite}/main/binary-amd64/Packages.gz`
    )
    if (!packages) {
      continue
    }
    const stanza = gunzipSync(packages)
      .toString('utf-8')
      .split('\n\n')
      .find(entry => entry.startsWith('Package: locales\n'))
    const filename = stanza?.match(/^Filename: (.+)$/m)?.[1]
    if (!filename) {
      throw new Error(`No locales package found for ${suite} on ${mirror}`)
    }
    return {mirror, filename}
  }
  throw new Error(`Suite ${suite} not found on any mirror`)
}

async function getSupportedLocales(suite: string): Promise<string[]> {
  const {mirror, filename} = await findLocalesPackage(suite)
  const deb = await download(`${mirror}/${filename}`)
  if (!deb) {
    throw new Error(`Package ${mirror}/${filename} not found`)
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locales-'))
  try {
    const debFile = path.join(tmpDir, 'locales.deb')
    fs.writeFileSync(debFile, deb)
    execFileSync('dpkg-deb', ['--extract', debFile, tmpDir])
    const supported = fs.readFileSync(
      path.join(tmpDir, 'usr/share/i18n/SUPPORTED'),
      'utf-8'
    )
    return supported
      .split('\n')
      .map(line => line.split(' ')[0])
      .filter(locale => locale && !locale.startsWith('#'))
      .sort()
  } finally {
    fs.rmSync(tmpDir, {recursive: true, force: true})
  }
}

async function updateLocales(): Promise<void> {
  const locales: Record<string, string[]> = {}
  for (const [release, suite] of Object.entries(RELEASES)) {
    locales[release] = await getSupportedLocales(suite)
    console.log(`${release} (${suite}): ${locales[release].length} locales`)
  }
  fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true})
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(locales, null, 2)}\n`)
}

await updateLocales()
