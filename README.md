# pi-gen-action

This action wraps [`pi-gen`](https://github.com/RPi-Distro/pi-gen) to make it easily accessible in GitHub workflows.
Generated images can subsequently be used in workflows, e.g. uploaded as build artifacts or further processed.

`pi-gen` is the official tool to generate Raspberry Pi OS images that can be flashed on SD cards. Refer to the
`pi-gen` repository for detailed information on the scripts and its usage.

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
    # Final image name.
    image-name: ''

    # Use qcow2 images to reduce space and runtime requirements.
    use-qcow2: 1

    # List of stage name to execute in given order. Relative and absolute paths to 
    # custom stage directories are allowed here. Note that by default pi-gen exports 
    # images in stage2 (lite), stage4 and stage5. You probably want to hook in custom 
    # stages before one of the exported stages. Otherwise, the action will make sure 
    # any custom stage will include an image export directive.
    stage-list: stage0 stage1 stage2

    # The release version to build images against. Valid values are jessie, stretch, 
    # buster, bullseye, and testing.
    release: bullseye

    # Compression to apply on final image (either "none", "zip", "xz" or "gz").
    compression: zip

    # Compression level to be used. From 0 to 9 (refer to the tool man page for more 
    # information on this. Usually 0 is no compression but very fast, up to 9 with the 
    # best compression but very slow).
    compression-level: 6

    # Default locale of the system image.
    locale: en_GB.UTF-8

    # Host name of the image.
    hostname: raspberrypi

    # Default keyboard keymap.
    keyboard-keymap: gb

    # Default keyboard layout.
    keyboard-layout: English (UK)

    # System timezone.
    timezone: Europe/London

    # Name of the initial user account.
    username: pi

    # Password of the intial user account, locked if empty.
    password: ''

    # SSID of a default wifi network to connect to.
    wpa-essid: ''

    # Password of default wifi network to connect to.
    wpa-password: ''

    # Wifi country code of default network to connect to.
    wpa-country: ''

    # Enable SSH access to Pi.
    enable-ssh: 0

    # Release version of pi-gen to use. This can both be a branch or tag name known in 
    # the pi-gen repository.
    pi-gen-version: arm64

    # Set whether a NOOBS image should be built as well. If enabled, the output 
    # directory containing the NOOBS files will be saved as output variable 
    # 'image-noobs-path'.
    enable-noobs: false

    # Comma or whitespace separated list of additional packages to install on host 
    # before running pi-gen.
    extra-host-dependencies: ''

    # Comma or whitespace separated list of additional modules to load on host before 
    # running pi-gen.
    extra-host-modules: ''

    # Path where selected pi-gen ref will be checked out to. If the path does not yet 
    # exist, it will be created (including its parents).
    pi-gen-dir: pi-gen

    # Print all output from pi-gen.
    verbose-output: false

    # Token to use for checking out pi-gen repo.
    github-token: ${{ github.token }}
```

## Scenarios
- [Install NodeJS from Nodesource in the target image](#install-nodejs-from-nodesource-in-the-target-image)
- [Enable detailed output from `pi-gen` build](#enable-detailed-output-from-pi-gen-build)
- [Upload final image as artifact]

### Install NodeJS from Nodesource in the target image
```yaml
jobs:
  pi-gen-nodejs:
    runs-on: ubuntu-latest
    steps:
      # Create a stage 'test-stage' instructing to add Nodesource repo and install nodejs as dependency
      - run: >
          mkdir -p test-stage/package-test && 
          echo -e "#!/bin/bash\napt-get install -y curl\ncurl -fsSL https://deb.nodesource.com/setup_16.x | bash -" > test-stage/package-test/00-run-chroot.sh &&
          chmod +x test-stage/package-test/00-run-chroot.sh &&
          echo "nodejs" > test-stage/package-test/01-packages && 
          echo -e "#!/bin/bash -e\nif [ ! -d \"\${ROOTFS_DIR}\" ]; then\n  copy_previous\nfi" > test-stage/prerun.sh &&
          chmod +x test-stage/prerun.sh && 
          touch test-stage/EXPORT_IMAGE

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

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)