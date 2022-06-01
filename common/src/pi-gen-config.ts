import {PathLike} from 'fs'
import * as fs from 'fs/promises'

export interface PiGenConfig {
  imgName: string
  release: string
  aptProxy?: string
  deployCompression: string
  compressionLevel: string
  localeDefault: string
  targetHostname: string
  keyboardKeymap: string
  keyboardLayout: string
  timezoneDefault: string
  firstUserName: string
  firstUserPass?: string
  wpaEssid?: string
  wpaPassword?: string
  wpaCountry?: string
  enableSsh: string
  pubkeySshFirstUser?: string
  pubkeyOnlySsh: string
  stageList: string
  useQcow2: string
}

export const DEFAULT_CONFIG: PiGenConfig = {
  imgName: 'test',
  release: 'bullseye',
  deployCompression: 'zip',
  compressionLevel: '6',
  localeDefault: 'en_GB.UTF-8',
  targetHostname: 'raspberrypi',
  keyboardKeymap: 'gb',
  keyboardLayout: 'English (UK)',
  timezoneDefault: 'Europe/London',
  firstUserName: 'pi',
  enableSsh: '0',
  pubkeyOnlySsh: '0',
  stageList: 'stage*',
  useQcow2: '1'
}

export async function writeToFile(
  config: PiGenConfig,
  file: PathLike
): Promise<void> {
  const configContent = Object.getOwnPropertyNames(config)
    .map(
      prop =>
        `${camelCaseToSnakeCase(prop)}="${config[prop as keyof PiGenConfig]}"`
    )
    .join('\n')
  return fs.writeFile(file, configContent)
}

export async function loadFromFile(file: PathLike): Promise<PiGenConfig> {
  const configLines = (await fs.readFile(file, {encoding: 'utf-8'})).split(/\n/)
  const config = {} as PiGenConfig

  for (const line of configLines) {
    const [label, value] = line.split(/=/, 2)
    const propName = snakeCaseToCamelCase(label)

    /* eslint-disable @typescript-eslint/no-explicit-any */
    ;(config as any)[propName as keyof PiGenConfig] = value
      .trim()
      .replace(/(?:^"|"$)/g, '')
  }

  return config
}

function camelCaseToSnakeCase(label: string): string {
  return label.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()
}

function snakeCaseToCamelCase(label: string): string {
  return label
    .toLowerCase()
    .replace(/_(?<camel>[a-z])/g, (match, letter) => letter.toUpperCase())
}
