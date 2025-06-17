// eslint-disable-next-line import/no-nodejs-modules
import {readFileSync, writeFileSync} from 'node:fs'
import {major} from 'semver'
import {load} from 'js-yaml'
import wrap from 'word-wrap'
// eslint-disable-next-line import/no-commonjs, @typescript-eslint/no-require-imports
const replaceSection = require('markdown-replace-section')

function getTagVersion(packageJson: string): number {
  const packageDesc = JSON.parse(
    readFileSync(packageJson, {encoding: 'utf-8'})
  ) as {version: string}
  return major(packageDesc.version)
}

function replaceUsageSection(
  readme: string,
  sectionTitle: string,
  content: string
): string {
  return replaceSection(readme, sectionTitle, content, true)
}

function buildUsageSection(
  actionYaml: Record<string, unknown>,
  actionVersion: number
): string {
  const usageSection = [
    '```yaml',
    `- uses: usimd/pi-gen-action@v${actionVersion}`,
    '  with:'
  ]

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  for (const key of Object.keys(actionYaml.inputs as {}).sort((a, b) =>
    a.localeCompare(b)
  )) {
    const input = (actionYaml.inputs as Record<string, unknown>)[key] as {
      description: string
      default: string | number
    }
    const description = input.description.replace(/\s+/g, ' ')
    usageSection.push(
      wrap(description, {indent: '    # ', width: 80}).trimEnd()
    )

    let defaultValue
    if (input.default?.toString()) {
      defaultValue =
        typeof input.default === 'string' ? `${input.default}` : input.default
    } else {
      defaultValue = "''"
    }

    usageSection.push(`    ${key}: ${defaultValue}`)
    usageSection.push('')
  }

  return usageSection.join('\n').concat('```')
}

function updateUsage(
  readmePath: string,
  actionYamlPath: string,
  packageJsonPath: string
): void {
  const actionYaml = load(readFileSync(actionYamlPath).toString()) as Record<
    string,
    unknown
  >
  const originalReadme = readFileSync(readmePath).toString()
  const actionVersion = getTagVersion(packageJsonPath)

  const updatedReadme = replaceUsageSection(
    originalReadme,
    'Usage',
    buildUsageSection(actionYaml, actionVersion)
  )
  writeFileSync(readmePath, updatedReadme)
}

updateUsage('README.md', 'action.yml', 'package.json')
