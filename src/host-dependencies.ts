const arch = process.arch // 'x64' or 'arm64'
const packages = ['zstd']
const modules: string[] = []

if (arch === 'x64') {
  packages.push('binfmt-support', 'qemu-user-static')
  modules.push('binfmt_misc')
}

export const hostDependencies = {packages, modules}
