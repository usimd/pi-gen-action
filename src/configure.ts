import * as core from '@actions/core'
import {DEFAULT_CONFIG, validateConfig, PiGenConfig} from './pi-gen-config'
import {colorize, color} from 'json-colorizer'

export async function configure(): Promise<PiGenConfig> {
  try {
    core.startGroup('Validating input and generating pi-gen config')

    const userConfig = DEFAULT_CONFIG

    userConfig.imgName = core.getInput('image-name', {required: true})

    const stageList = core.getInput('stage-list').split(/\s+/)
    userConfig.stageList =
      stageList.length > 0 ? stageList : DEFAULT_CONFIG.stageList

    userConfig.release = core.getInput('release') || DEFAULT_CONFIG.release
    userConfig.deployCompression =
      core.getInput('compression') || DEFAULT_CONFIG.deployCompression
    userConfig.compressionLevel =
      core.getInput('compression-level') || DEFAULT_CONFIG.compressionLevel
    userConfig.localeDefault =
      core.getInput('locale') || DEFAULT_CONFIG.localeDefault
    userConfig.targetHostname =
      core.getInput('hostname') || DEFAULT_CONFIG.targetHostname
    userConfig.keyboardKeymap =
      core.getInput('keyboard-keymap') || DEFAULT_CONFIG.keyboardKeymap
    userConfig.keyboardLayout =
      core.getInput('keyboard-layout') || DEFAULT_CONFIG.keyboardLayout
    userConfig.timezoneDefault =
      core.getInput('timezone') || DEFAULT_CONFIG.timezoneDefault
    userConfig.firstUserName =
      core.getInput('username') || DEFAULT_CONFIG.firstUserName
    userConfig.firstUserPass =
      core.getInput('password') || DEFAULT_CONFIG.firstUserPass
    userConfig.disableFirstBootUserRename =
      core.getInput('disable-first-boot-user-rename') ||
      DEFAULT_CONFIG.disableFirstBootUserRename
    userConfig.wpaEssid = core.getInput('wpa-essid') || DEFAULT_CONFIG.wpaEssid
    userConfig.wpaPassword =
      core.getInput('wpa-password') || DEFAULT_CONFIG.wpaPassword
    userConfig.wpaCountry =
      core.getInput('wpa-country') || DEFAULT_CONFIG.wpaCountry
    userConfig.enableSsh =
      core.getInput('enable-ssh') || DEFAULT_CONFIG.enableSsh
    userConfig.pubkeySshFirstUser = core.getInput('pubkey-ssh-first-user')
    userConfig.pubkeyOnlySsh =
      core.getInput('pubkey-only-ssh') || DEFAULT_CONFIG.pubkeyOnlySsh
    userConfig.enableNoobs =
      core.getBooleanInput('enable-noobs')?.toString() ||
      DEFAULT_CONFIG.enableNoobs
    userConfig.exportLastStageOnly =
      core.getBooleanInput('export-last-stage-only')?.toString() ||
      DEFAULT_CONFIG.exportLastStageOnly
    userConfig.dockerOpts = core.getInput('docker-opts')
    userConfig.setfcap = core.getInput('setfcap') || DEFAULT_CONFIG.setfcap
    userConfig.piGenRelease =
      core.getInput('pi-gen-release') || DEFAULT_CONFIG.piGenRelease
    userConfig.aptProxy = core.getInput('apt-proxy') || DEFAULT_CONFIG.aptProxy

    await validateConfig(userConfig)

    core.info(
      colorize(JSON.stringify(userConfig, filterConfigFormat, 2), {
        colors: {
          Bracket: color.magenta,
          Brace: color.magenta,
          StringKey: color.cyanBright,
          BooleanLiteral: color.blueBright,
          NumberLiteral: color.greenBright,
          NullLiteral: color.blueBright,
          StringLiteral: color.red,
          Whitespace: color.reset,
          Colon: color.white,
          Comma: color.white
        }
      })
    )

    return userConfig
  } finally {
    core.endGroup()
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function filterConfigFormat(key: string, value: any): any {
  if (typeof value === 'string' && !value) {
    return undefined
  }

  if (key.toLowerCase().includes('pass')) {
    return '***'
  }

  return value
}
