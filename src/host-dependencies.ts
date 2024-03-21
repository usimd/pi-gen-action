export const hostDependencies = {
  packages: [
    'binfmt-support',
    'qemu-user-static',
    'nbd-server',
    'nbd-client'
  ],
  modules: ['binfmt_misc', 'nbd']
}
