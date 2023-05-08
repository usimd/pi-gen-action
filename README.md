[![unit-tests](https://github.com/usimd/pi-gen-action/actions/workflows/test.yml/badge.svg)](https://github.com/usimd/pi-gen-action/actions/workflows/test.yml)
[![integration-tests](https://github.com/usimd/pi-gen-action/actions/workflows/integration-test.yml/badge.svg)](https://github.com/usimd/pi-gen-action/actions/workflows/integration-test.yml)
[![codecov](https://codecov.io/gh/usimd/pi-gen-action/branch/master/graph/badge.svg?token=4O680QXTOC)](https://codecov.io/gh/usimd/pi-gen-action)

# pi-gen-action

This action wraps [`pi-gen`](https://github.com/RPi-Distro/pi-gen) to make it easily accessible in GitHub workflows.
Generated images can subsequently be used in workflows, e.g. uploaded as build artifacts or further processed.

`pi-gen` is the official tool to generate Raspberry Pi OS images that can be flashed on SD cards. Refer to the
`pi-gen` repository for detailed information on the scripts and its usage.

**NOTE**: This action requires a Debian-based distribution as runner (i.e. `ubuntu-latest`), since it invokes tools
like `sudo` and `apt-get` and relies on QEMU and other Linux native components.

## Default behavior

The minimum input to the action will be the `image-name` and the `stage-list` containing the list of `pi-gen` stages
and/or custom stages. This will build all stages and export the last stage (including all previous changes) as an
image.

If multiple images should be exported, disable the `export-last-stage-only` property and configure `pi-gen`'s
[`EXPORT_IMAGE`](https://github.com/RPi-Distro/pi-gen#how-the-build-process-works) in the respective stages accordingly.
This will keep the default `pi-gen` export directives unchanged. If changes in the `pi-gen` internal stages are
required, a custom stage at first position in the list could [perform the changes](#modify-pi-gen-internal-stages)
in the other directories.

## Outputs

### `image-path`

If an image was built successfully, the action will set this property to point to the file. This will be located
in `${{ inputs.pi-gen-dir }}/deploy`.

### `image-noobs-path`

If NOOBS build is enabled by setting `${{ inputs.enable-noobs }}` to `true`, the property will point to the directory
in `pi-gen`'s output directory containing the build result.

## How it works

The action exposes most of `pi-gen`'s configuration properties as input variables and performs sanity checks on the
given input (or assumes) default values as stated in `pi-gen`'s README.

If user config seems valid, the action will check out the configured ref of `pi-gen` locally and install required
host dependencies for the build.

Custom user stages (present as directories) are mounted to the build container and resolved in `pi-gen`'s stage
configuration. The custom stage should follow `pi-gen`'s
[conventions](https://github.com/RPi-Distro/pi-gen#how-the-build-process-works) to be executed properly. The action
tries to make sure the stage is respected and its changes are included in the final image.

## Usage

```yaml
- uses: usimd/pi-gen-action@v1
  with:
    # Compression to apply on final image (either "none", "zip", "xz" or "gz").
    compression: zip

    # Compression level to be used. From 0 to 9 (refer to the tool man page for more 
    # information on this. Usually 0 is no compression but very fast, up to 9 with the 
    # best compression but very slow).
    compression-level: 6

    # Disable the renaming of the first user during the first boot. This make it so 
    # 'username' stays activated. 'username' must be set for this to work. Please be 
    # aware of the implied security risk of defining a default username and password 
    # for your devices.
    disable-first-boot-user-rename: 0

    # Additional options to include in PIGEN_DOCKER_OPTS
    docker-opts: ''

    # Set whether a NOOBS image should be built as well. If enabled, the output 
    # directory containing the NOOBS files will be saved as output variable 
    # 'image-noobs-path'.
    enable-noobs: false

    # Enable SSH access to Pi.
    enable-ssh: 0

    # If this feature is enabled, the action will configure pi-gen to not export any 
    # stage as image but the last one defined in property 'stage-list'. This is 
    # helpful when building a single image flavor (in contrast to building a 
    # lite/server and full-blown desktop image), since it speeds up the build process 
    # significantly.
    export-last-stage-only: true

    # Comma or whitespace separated list of additional packages to install on host 
    # before running pi-gen. Use this list to add any packages your custom stages may 
    # require. Note that this is not affecting the final image. In order to add 
    # additional packages, you need to add a respective 'XX-packages' file in your 
    # custom stage.
    extra-host-dependencies: ''

    # Comma or whitespace separated list of additional modules to load on host before 
    # running pi-gen. If your custom stage requires additional software or kernel 
    # modules to be loaded, add them here. Note that this is not meant to configure 
    # modules to be loaded in the target image.
    extra-host-modules: ''

    # Token to use for checking out pi-gen repo.
    github-token: ${{ github.token }}

    # Host name of the image.
    hostname: raspberrypi

    # Final image name.
    image-name: ''

    # Default keyboard keymap.
    keyboard-keymap: gb

    # Default keyboard layout.
    keyboard-layout: English (UK)

    # Default locale of the system image.
    locale: en_GB.UTF-8

    # Password of the intial user account, locked if empty.
    password: ''

    # Path where selected pi-gen ref will be checked out to. If the path does not yet 
    # exist, it will be created (including its parents).
    pi-gen-dir: pi-gen

    # GitHub repository to fetch pi-gen from, must be a fork from RPi-Distro/pi-gen.
    pi-gen-repository: RPi-Distro/pi-gen

    # Release version of pi-gen to use. This can both be a branch or tag name known in 
    # the pi-gen repository.
    pi-gen-version: arm64

    # The release version to build images against. Valid values are bullseye, buster,
    # stretch, jessie, and wheezy. 
    release: bullseye

    # Setting to `1` will prevent pi-gen from dropping the "capabilities" feature. 
    # Generating the root filesystem with capabilities enabled and running it from a 
    # filesystem that does not support capabilities (like NFS) can cause issues. Only 
    # enable this if you understand what it is.
    setfcap: ''

    # List of stage name to execute in given order. Relative and absolute paths to 
    # custom stage directories are allowed here. Note that by default pi-gen exports 
    # images in stage2 (lite), stage4 and stage5. You probably want to hook in custom 
    # stages before one of the exported stages. Otherwise, the action will make sure 
    # any custom stage will include an image export directive.
    stage-list: stage0 stage1 stage2

    # System timezone.
    timezone: Europe/London

    # Use qcow2 images to reduce space and runtime requirements.
    use-qcow2: 1

    # Name of the initial user account.
    username: pi

    # Print all output from pi-gen.
    verbose-output: false

    # Wifi country code of default network to connect to.
    wpa-country: ''

    # SSID of a default wifi network to connect to.
    wpa-essid: ''

    # Password of default wifi network to connect to.
    wpa-password: ''
```

## Scenarios
- [Install NodeJS from Nodesource in the target image](#install-nodejs-from-nodesource-in-the-target-image)
- [Enable detailed output from `pi-gen` build](#enable-detailed-output-from-pi-gen-build)
- [Upload final image as artifact](#upload-final-image-as-artifact)
- [Modify `pi-gen` internal stages](#modify-pi-gen-internal-stages)

### Install NodeJS from Nodesource in the target image
```yaml
jobs:
  pi-gen-nodejs:
    runs-on: ubuntu-latest
    steps:
      # Create a stage 'test-stage' instructing to add Nodesource repo and install nodejs as dependency
      - run: |
          mkdir -p test-stage/package-test &&
          {
          cat > test-stage/package-test/00-run-chroot.sh <<-EOF
          #!/bin/bash
          apt-get install -y curl
          curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
          EOF
          } &&
          chmod +x test-stage/package-test/00-run-chroot.sh &&
          echo "nodejs" > test-stage/package-test/01-packages &&
          {
          cat > test-stage/prerun.sh <<-EOF
          #!/bin/bash -e
          if [ ! -d "\${ROOTFS_DIR}" ]; then
            copy_previous
          fi
          EOF
          } &&
          chmod +x test-stage/prerun.sh

      - uses: usimd/pi-gen-action@v1
        with:
          image-name: test
          stage-list: stage0 stage1 stage2 ./test-stage
```

### Enable detailed output from `pi-gen` build
```yaml
jobs:
  pi-gen-verbose:
    runs-on: ubuntu-latest
    steps:
      - uses: usimd/pi-gen-action@v1
        with:
          image-name: test
          verbose-output: true
```

### Upload final image as artifact
```yaml
jobs:
  pi-gen-upload-image:
    runs-on: ubuntu-latest
    steps:
      - uses: usimd/pi-gen-action@v1
        id: build
        with:
          image-name: test

      - uses: actions/upload-artifact@v3
        with:
          name: pi-gen-image
          path: ${{ steps.build.outputs.image-path }}
```

### Modify `pi-gen` internal stages

In this scenario, a dummy preparation stage `clean-stage` is prepended to the list of stages which will remove
export directives of `stage4` and `stage5` in the internally mounted stage volumes.

```yaml
jobs:
  pi-gen-modified-stages:
    runs-on: ubuntu-latest
    steps:
      - run: |
          mkdir -p clean-stage &&
          {
          cat > clean-stage/prerun.sh <<-EOF
          #!/bin/bash
          rm -f ${{ github.workspace }}/${{ inputs.custom-pi-gen-dir }}/stage[45]/EXPORT*
          EOF
          } &&
          chmod +x clean-stage/prerun.sh

      - uses: usimd/pi-gen-action@v1
        with:
          image-name: test
          stage-list: clean-stage stage0 stage1 stage2 custom-stage stage3 stage4
          pi-gen-dir: ${{ inputs.custom-pi-gen-dir }}
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
