export const hostDependencies = {
  packages: [
    'binfmt-support',
    'qemu-user-static',
    'qemu-utils',
    'nbd-server',
    'nbd-client',
    'openssh-client'
  ],
  modules: ['binfmt_misc', 'nbd']
}
