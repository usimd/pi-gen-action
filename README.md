# pi-gen-action

This action wraps [`pi-gen`](https://github.com/RPi-Distro/pi-gen) to make it easily accessible in GitHub workflows.

# How it works

The action exposes most of `pi-gen`'s configuration properties as input variables and performs sanity checks on the
given input (or assumes) default values as stated in `pi-gen`'s README.

If user config seems valid, the action will check out the configured ref of `pi-gen` locally and install required
host dependencies for the build.

Custom user stages (present as directories) are mounted to the build container and resolved in `pi-gen`'s stage
configuration.

# Usage

```yaml
- uses: usimd/pi-gen-action@v1
  with:
    # Final image name.
    image-name: ''

    # Use qcow2 images to reduce space and runtime requirements.
    #
    # Default: 1
    use-qcow2: ''

    # List of stage name to execute in given order. Relative and absolute paths to 
    # custom stage directories are allowed here. Note that by default pi-gen exports 
    # images in stage2 (lite), stage4 and stage5. You probably want to hook in custom 
    # stages before one of the exported stages.
    #
    # Default: stage0 stage1 stage2
    stage-list: ''

    # The release version to build images against. Valid values are jessie, stretch, 
    # buster, bullseye, and testing.
    #
    # Default: bullseye
    release: ''

    # Compression to apply on final image (either "none", "zip", "xz" or "gz").
    #
    # Default: zip
    compression: ''

    # Compression level to be used. From 0 to 9 (refer to the tool man page for more 
    # information on this. Usually 0 is no compression but very fast, up to 9 with the 
    # best compression but very slow).
    #
    # Default: 6
    compression-level: ''

    # Default locale of the system image.
    #
    # Default: en_GB.UTF-8
    locale: ''

    # Host name of the image.
    #
    # Default: raspberrypi
    hostname: ''

    # Default keyboard keymap.
    #
    # Default: gb
    keyboard-keymap: ''

    # Default keyboard layout.
    #
    # Default: English (UK)
    keyboard-layout: ''

    # System timezone.
    #
    # Default: Europe/London
    timezone: ''

    # Name of the initial user account.
    #
    # Default: pi
    username: ''

    # Password of the intial user account, locked if empty.
    password: ''

    # SSID of a default wifi network to connect to.
    wpa-essid: ''

    # Password of default wifi network to connect to.
    wpa-password: ''

    # Wifi country code of default network to connect to.
    wpa-country: ''

    # Enable SSH access to Pi.
    enable-ssh: ''

    # Release version of pi-gen to use. This can both be a branch or tag name known in 
    # the pi-gen repository.
    #
    # Default: arm64
    pi-gen-version: ''

    # Set whether a noobs image should be built as well.
    enable-noobs: ''

    # Comma or whitespace separated list of additional packages to install on host 
    # before running pi-gen.
    extra-host-dependencies: ''

    # Comma or whitespace separated list of additional modules to load on host before 
    # running pi-gen.
    extra-host-modules: ''

    # Path where selected pi-gen ref will be checked out to. If the path does not yet 
    # exist, it will be created (including its parents).
    #
    # Default: pi-gen
    pi-gen-dir: ''

    # Print all output from pi-gen.
    verbose-output: ''

    # Token to use for checking out pi-gen repo.
    #
    # Default: ${{ github.token }}
    github-token: ''
```

# Scenarios

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)