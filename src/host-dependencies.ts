export const hostDependencies = {
  packages: [
    'binfmt-support',
    'qemu-user-static',
    'qemu-utils',
    'nbd-server',
    'nbd-client'
  ],
  modules: ['binfmt_misc', 'nbd']
}
