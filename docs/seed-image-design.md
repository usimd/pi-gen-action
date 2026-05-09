# Seed Infrastructure Design (v2)

## Problem Statement

Pi-gen builds are slow. Two distinct bottlenecks exist:

1. **Container image build** (`docker build` in `build-docker.sh`): Installs
   `debootstrap`, `qemu-user-static`, and ~20 other packages into the pi-gen
   container image from scratch every run. Takes 2–5 minutes.

2. **Stages 0–2 execution**: `debootstrap` + core package installation inside
   the container. Takes 20–30 minutes and rarely changes between user builds.

Even with `WorkDirCache` on `add-caching`, the **first** build for every
repository is completely cold. And `@actions/cache` is per-repo, 10 GB limited,
and evicts after 7 days.

## Design Principles

- **Two independent layers of pre-computation**, each helping separately:
  - **Pre-built pi-gen Docker image** — skip `docker build` (the tooling layer)
  - **Pre-populated seed cache** — skip stage 0–2 execution (the work dir)
- **Never blindly skip stages** — auto-detect whether stages are unmodified
  before skipping; if the user has custom stages interleaved or modified
  built-in stages, run them normally.
- **Explicit opt-in** — both layers are disabled by default. Users must
  consciously enable them. Pre-built artifacts from third parties are a
  supply-chain trust decision that belongs to the user, not to us.
- **Graceful fallback** — every optimization is optional; failures degrade to
  the standard build path, never to a hard error.
- **Complement, don't replace** — the existing `WorkDirCache` continues to
  provide incremental caching. Seeds provide the cold-start baseline.
- **Self-buildable** — users who don't trust our published artifacts can
  build their own seeds using the same workflows we publish. The action
  accepts any URL or image reference, not just ours.

---

## Layer 1: Pre-built Pi-Gen Docker Image

### What

`build-docker.sh` runs `docker build` from pi-gen's Dockerfile every time:

```dockerfile
ARG BASE_IMAGE=debian:bullseye
FROM ${BASE_IMAGE}
RUN apt-get -y update && apt-get -y install --no-install-recommends \
    git vim parted quilt coreutils qemu-user-static debootstrap ...
COPY . /pi-gen/
VOLUME [ "/pi-gen/work", "/pi-gen/deploy"]
```

This image is deterministic for a given pi-gen commit. We can pre-build and
publish it, then have `build-docker.sh` skip the `docker build` step when a
pre-built image is available.

### How

**Creation** — Weekly CI workflow:

```yaml
# .github/workflows/build-pigen-image.yml
name: Build pi-gen Docker images
on:
  schedule:
    - cron: '0 3 * * 0'   # Weekly
  workflow_dispatch:
    inputs:
      pi-gen-version:
        default: 'master'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      packages: write
    steps:
      - name: Clone pi-gen
        run: git clone --depth 1 -b ${{ inputs.pi-gen-version || 'master' }} \
             https://github.com/RPi-Distro/pi-gen.git /tmp/pi-gen

      - name: Build & push
        run: |
          cd /tmp/pi-gen
          PIGEN_SHA=$(git rev-parse --short HEAD)

          # Build exactly as build-docker.sh does
          docker build --build-arg BASE_IMAGE=i386/debian:trixie -t pi-gen .

          IMAGE=ghcr.io/${{ github.repository_owner }}/pi-gen
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker tag pi-gen ${IMAGE}:${PIGEN_SHA}
          docker tag pi-gen ${IMAGE}:latest
          docker push ${IMAGE}:${PIGEN_SHA}
          docker push ${IMAGE}:latest
```

**Consumption** — In `build-docker.sh`, the `docker build` line:

```bash
${DOCKER} build --build-arg BASE_IMAGE=${BASE_IMAGE} -t pi-gen "${DIR}"
```

Pi-gen already tags the result as `pi-gen`. If an image named `pi-gen` already
exists locally, this is a no-op (Docker cache hit). So the action can simply
`docker pull` and `docker tag` before `build-docker.sh` runs:

```typescript
// In src/pi-gen-image.ts
export async function pullPiGenImage(imageRef: string): Promise<boolean> {
  // docker pull ghcr.io/usimd/pi-gen:latest
  // docker tag ghcr.io/usimd/pi-gen:latest pi-gen
  // Now build-docker.sh's `docker build` is a cache hit (all layers present)
}
```

**Key point**: This does NOT prevent customization. `build-docker.sh` still
runs `docker build`, which checks the layer cache. If the user's pi-gen
checkout has local Dockerfile modifications, Docker will rebuild the changed
layers. We're just pre-warming the cache, not bypassing the step.

### Input

```yaml
pi-gen-image:
  description: |
    Pre-built pi-gen Docker image reference. When set, the image is pulled
    and tagged locally before build-docker.sh runs, allowing Docker to
    skip rebuilding pi-gen's tooling layer from scratch. The build-docker.sh
    step still runs and will rebuild any layers that differ from the
    pre-built image.
    Disabled by default. Users must explicitly opt in.
    Example: ghcr.io/usimd/pi-gen:latest
  required: false
  default: ''
```

### Size & Speed

The pi-gen Docker image is ~400 MB compressed. Pull time on GHA runners:
~10–15 seconds. Saves 2–5 minutes of `apt-get install` inside `docker build`.

---

## Layer 2: Pre-populated Seed Cache (Work Directory)

### What

A compressed tarball of the pi-gen `work/` directory after stages 0–2 have
completed. This is the same content that `WorkDirCache` would produce, but
pre-built and published as a downloadable artifact rather than stored in
`@actions/cache`.

### Format: GitHub Release Asset (not an OCI image)

The work directory is just data (rootfs trees, build logs). It doesn't need
to be a container image. A `tar.zstd` file attached to a GitHub Release is:

- **Persistent** — no 7-day eviction like `@actions/cache`
- **Cross-repo** — any repo using the action can download it
- **Versioned** — releases are tagged with pi-gen version + release name
- **Free** — GitHub Releases are free for public repos, generous for private
- **Simple** — `curl` + `tar` to extract; no Docker plumbing needed

**Release tagging scheme:**

```
seed-<release>-<pi-gen-short-sha>       # e.g. seed-trixie-a1b2c3d
```

Each release has a single asset:

```
seed-<release>-stage<N>.tar.zstd        # e.g. seed-trixie-stage2.tar.zstd
```

### Creation

```yaml
# .github/workflows/build-seed-cache.yml
name: Build seed cache
on:
  schedule:
    - cron: '0 4 * * 0'   # Weekly, after pi-gen image build
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # For creating releases
    strategy:
      matrix:
        release: [trixie]
    steps:
      - uses: actions/checkout@v4

      - name: Build stages 0-2
        run: |
          git clone --depth 1 https://github.com/RPi-Distro/pi-gen.git /tmp/pi-gen
          cd /tmp/pi-gen
          cat > config <<'EOF'
          IMG_NAME=seed
          RELEASE=${{ matrix.release }}
          EOF

          # Skip stages 3-5
          for i in 3 4 5; do touch "stage${i}/SKIP"; done

          sudo PRESERVE_CONTAINER=1 ./build-docker.sh -c config

          # Extract work dir from container
          docker cp pigen_work:/pi-gen/work /tmp/seed-work

          # Create compressed archive (exclude pseudo-filesystems)
          sudo tar -C /tmp/seed-work -cf - \
            --exclude='./*/rootfs/proc/*' \
            --exclude='./*/rootfs/sys/*' \
            --exclude='./*/rootfs/dev/*' \
            . | zstd -T0 -9 > /tmp/seed-${{ matrix.release }}-stage2.tar.zstd

      - name: Create release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PIGEN_SHA=$(cd /tmp/pi-gen && git rev-parse --short HEAD)
          TAG="seed-${{ matrix.release }}-${PIGEN_SHA}"
          gh release create "${TAG}" \
            --title "Seed cache: ${{ matrix.release }} (pi-gen ${PIGEN_SHA})" \
            --notes "Pre-built work directory for stages 0-2" \
            /tmp/seed-${{ matrix.release }}-stage2.tar.zstd

          # Also update a "latest" release for convenience
          gh release delete "seed-${{ matrix.release }}-latest" --yes || true
          gh release create "seed-${{ matrix.release }}-latest" \
            --title "Seed cache: ${{ matrix.release }} (latest)" \
            --notes "Pre-built work directory for stages 0-2 (pi-gen ${PIGEN_SHA})" \
            /tmp/seed-${{ matrix.release }}-stage2.tar.zstd
```

### Consumption

New class: `SeedCache` in `src/seed-cache.ts`

```typescript
export class SeedCache {
  constructor(
    private release: string,         // e.g. "trixie"
    private seedStage: number,       // e.g. 2
    private workDirPath: string,     // e.g. "/tmp/pi-gen-work"
    private seedSource?: string      // explicit URL or release tag override
  ) {}

  /**
   * Download and extract the seed cache into the work directory.
   * Returns true if successful, false if seed unavailable/failed.
   */
  async restore(): Promise<boolean> {
    // 1. Determine download URL:
    //    - If seedSource is an explicit URL, use it directly
    //    - Otherwise, construct from release:
    //      https://github.com/usimd/pi-gen-action/releases/download/
    //        seed-<release>-latest/seed-<release>-stage<N>.tar.zstd
    //
    // 2. curl -fsSL <url> | zstd -d | sudo tar -C <workDirPath> -xf -
    //
    // 3. Returns true on success, false + warning on failure
  }

  /**
   * Rename the seed's IMG_NAME subdirectory to match the user's config.
   * Seed is built with IMG_NAME=seed; user may use a different name.
   */
  async renameWorkDir(userImgName: string): Promise<void> {
    // sudo mv <workDirPath>/seed <workDirPath>/<userImgName>
  }
}
```

### Input

```yaml
seed-cache:
  description: |
    URL for a pre-built seed cache (tar.zstd) containing the pi-gen work
    directory for early stages. When provided and stages are detected as
    unmodified, the action extracts the seed and skips those stages
    automatically. Falls back to a normal build if the seed is unavailable
    or stages have been modified.
    Disabled by default. Users must explicitly opt in by providing a URL.
    Can point to an official seed from this project's GitHub Releases, a
    self-built seed, or any trusted source.
    Example: https://github.com/usimd/pi-gen-action/releases/download/seed-trixie-latest/seed-trixie-stage2.tar.zstd
  required: false
  default: ''
```

### Size

| Seed level | Approx tar.zstd size |
|---|---|
| stage0 only | ~150 MB |
| stage0 + stage1 | ~350 MB |
| stage0 + stage1 + stage2 | ~600 MB |

Download + extract time on GHA runners: ~15–30 seconds (vs. 25 min to build).

---

## Smart Stage Skip Detection

**Stages are only skipped when the action can verify they are unmodified.**
This replaces the v1 design's "blindly skip" approach.

### Detection Algorithm

After `clonePigen()` resolves the pi-gen checkout and `configure()` produces
the final `stageList`, the action inspects the stage list to determine which
stages are safe to skip:

```typescript
// src/seed-stage-detection.ts

/**
 * Determine the highest stage number that can be safely skipped
 * because it uses the unmodified, built-in pi-gen stage directory.
 *
 * Returns -1 if no stages can be skipped.
 */
export function detectSkippableStages(
  stageList: string[],
  piGenDirectory: string,
  maxSeedStage: number           // from the seed cache (e.g. 2)
): number {
  // Walk the stage list from the beginning. A stage is skippable if:
  //
  // 1. It is a BUILT-IN stage (resolves to <piGenDirectory>/stageN)
  //    - Custom stages (absolute paths outside piGenDirectory) are NOT skippable
  //
  // 2. It appears in the EXPECTED POSITION
  //    - stageList[0] must be stage0, stageList[1] must be stage1, etc.
  //    - If a custom stage is inserted at position 1 (e.g. stage0, my-stage, stage1),
  //      we can only skip stage0 (position 0), not stage1 (which is now at position 2)
  //    - Actually: we can't skip ANY stage after a custom insertion because the
  //      rootfs chain is broken (the custom stage's output isn't in the seed)
  //
  // 3. Its stage number does not exceed maxSeedStage
  //
  // The scan stops at the first non-skippable stage.

  let lastSkippable = -1

  for (let i = 0; i < stageList.length && i <= maxSeedStage; i++) {
    const stageDir = stageList[i]
    const expectedBuiltinDir = path.join(piGenDirectory, `stage${i}`)

    // Must resolve to the built-in stage directory
    if (path.resolve(stageDir) !== path.resolve(expectedBuiltinDir)) {
      break  // Custom stage or out-of-order; stop here
    }

    lastSkippable = i
  }

  return lastSkippable
}
```

### Examples

| User's `stage-list` | Seed has stages 0–2 | Result |
|---|---|---|
| `stage0 stage1 stage2 stage3` | ✓ | Skip 0–2 |
| `stage0 stage1 stage2 stage3 stage4 stage5` | ✓ | Skip 0–2 |
| `stage0 stage1 stage2 ./my-stage stage3` | ✓ | Skip 0–2 (custom after seed) |
| `stage0 stage1 ./my-stage stage2 stage3` | ✓ | Skip 0–1 only (custom breaks chain at position 2) |
| `stage0 ./my-stage stage1 stage2 stage3` | ✓ | Skip 0 only (custom at position 1) |
| `./my-stage stage0 stage1 stage2 stage3` | ✓ | Skip nothing (position 0 is not stage0) |
| `stage2 stage3` | ✓ | Skip nothing (position 0 is not stage0) |

### Placing SKIP Files

Once we know which stages to skip, we place `SKIP` files:

```typescript
async function applySkips(
  piGenDirectory: string,
  lastSkippableStage: number
): Promise<void> {
  for (let i = 0; i <= lastSkippableStage; i++) {
    const skipFile = path.join(piGenDirectory, `stage${i}`, 'SKIP')
    await fs.writeFile(skipFile, '')
    core.info(`Skipping stage${i} (covered by seed cache)`)
  }
}
```

Pi-gen's `build.sh` sets `PREV_ROOTFS_DIR` outside the `SKIP` check:

```bash
run_stage(){
    ROOTFS_DIR="${STAGE_WORK_DIR}"/rootfs
    if [ ! -f SKIP ]; then
        # ... run sub-stages
    fi
    PREV_STAGE="${STAGE}"
    PREV_ROOTFS_DIR="${ROOTFS_DIR}"   # ← Always set
}
```

So the first non-skipped stage correctly finds `PREV_ROOTFS_DIR` pointing to
the seed's rootfs for the last skipped stage. ✓

---

## Combined Flow

```
main()
├── configure()                          # Parse inputs, build PiGenConfig
├── installHostDependencies()
│
├── if (piGenImage configured):
│   └── pullPiGenImage()                 # docker pull + tag → warm layer cache
│                                        # (build-docker.sh still runs docker build)
│
├── clonePigen()                         # Clone pi-gen source
│
├── if (cacheEnabled):
│   ├── WorkDirCache.restore()           # Restore from @actions/cache (if available)
│   └── AptCache.start()
│
├── if (seedCache enabled AND no work dir cache hit):
│   ├── SeedCache.restore()              # Download + extract seed tar.zstd
│   ├── SeedCache.renameWorkDir()        # Rename seed→user IMG_NAME
│   ├── detectSkippableStages()          # Check which stages are safe to skip
│   └── applySkips()                     # Place SKIP files
│
└── piGenBuild(workDirMount)             # Build (skipping seeded stages)
```

**Interaction between caches:**

| WorkDirCache hit? | SeedCache available? | Behavior |
|---|---|---|
| Yes (warm) | Any | Use work dir cache; skip seed (cache is fresher) |
| No (cold) | Yes | Use seed cache; provides baseline for first build |
| No | No | Full build from scratch (current behavior) |

The work-dir cache takes priority because it reflects the user's actual build
state (including custom stages). The seed is only used as a cold-start fallback.

---

## IMG_NAME Mismatch

Seeds are built with `IMG_NAME=seed`. The user's config may use a different
name. Pi-gen's `WORK_DIR` is `work/${IMG_NAME}`, so directory structure must
match.

```
Seed archive:                       After rename:
  seed/stage0/rootfs/        →        myimage/stage0/rootfs/
  seed/stage1/rootfs/        →        myimage/stage1/rootfs/
  seed/stage2/rootfs/        →        myimage/stage2/rootfs/
```

Simple `sudo mv` before the build starts. Contents are IMG_NAME-agnostic.

---

## Supply Chain Trust Model

Pre-built artifacts (Docker images and seed caches) are a supply chain trust
surface. A compromised seed could inject malware into every image built from it.

### Mitigations

1. **Disabled by default.** Neither `pi-gen-image` nor `seed-cache` has a
   non-empty default. Users must explicitly opt in by providing a reference,
   making the trust decision conscious.

2. **Self-buildable.** Both the pi-gen image workflow and the seed cache
   workflow are published in this repository. Users who don't trust our
   published artifacts can fork these workflows and build their own:

   ```yaml
   # User's own workflow builds their seed
   seed-cache: https://github.com/MY-ORG/my-pi-gen-seeds/releases/download/latest/seed-trixie-stage2.tar.zstd
   ```

3. **Pinnable by SHA.** Seed releases are tagged with the pi-gen commit SHA.
   Users can pin to a specific, audited version rather than tracking `latest`:

   ```yaml
   seed-cache: https://github.com/usimd/pi-gen-action/releases/download/seed-trixie-a1b2c3d/seed-trixie-stage2.tar.zstd
   ```

4. **Transparent build provenance.** The seed build workflows run in GitHub
   Actions with full logs. Users can verify exactly what went into a seed by
   inspecting the workflow run that created the release.

5. **Non-skippable rebuild.** Even with a seed, pi-gen's `build-docker.sh`
   still runs `docker build` (layer 1 is a cache warm, not a bypass). And
   skipped stages still have their `PREV_ROOTFS_DIR` available for the first
   non-skipped stage to `rsync` from — meaning the non-skipped stages can
   re-apply any policies or packages on top of the seed's rootfs.

6. **URL validation.** The action validates that `seed-cache` is an HTTPS URL
   before downloading. No `file://`, `ftp://`, or other schemes are accepted.

### What users should know

The README should clearly document:
- Seeds contain a root filesystem built from Debian packages. Using someone
  else's seed is equivalent to trusting their Debian mirror + build environment.
- For maximum trust: build your own seeds, or don't use seeds at all (the
  action works fine without them — it's purely an optimization).
- The `seed-cache` and `pi-gen-image` inputs accept arbitrary URLs/refs.
  Only point them at sources you trust.

---

## Failure Modes

| Scenario | Behavior |
|---|---|
| Seed download fails (404, network) | Warning + full build (seed is optional) |
| Seed extraction fails | Warning + full build |
| Pi-gen image pull fails | Warning + `docker build` from scratch |
| Custom stage detected in seed range | Skip only the safe prefix; warn user |
| Release mismatch (seed=bookworm, config=trixie) | Don't use seed; warn |
| Work dir rename fails | Error (likely permissions; surface to user) |

All seed/image failures are non-fatal. The action always falls back to a
working build path.

---

## Action Interface Summary

Three new inputs (all disabled by default — explicit opt-in required):

```yaml
pi-gen-image:
  description: |
    Pre-built pi-gen Docker image reference to speed up container creation.
    When set, pulled and tagged locally so build-docker.sh skips rebuilding
    the tooling layer. The build still runs and rebuilds changed layers.
    Disabled by default.
  required: false
  default: ''

seed-cache:
  description: |
    URL to a pre-built seed cache (tar.zstd) for early stages. When set,
    downloaded and extracted as a cold-start baseline. Only used when stages
    are detected as unmodified built-in stages.
    Disabled by default.
  required: false
  default: ''

seed-stage:
  description: |
    Last stage number included in the seed cache (0-indexed). Used with
    seed-cache to determine which stages can potentially be skipped.
    Only relevant when seed-cache is not 'none'.
  required: false
  default: '2'
```

---

## Implementation Plan

**Phase 1: Pre-built pi-gen Docker image**
1. Add `.github/workflows/build-pigen-image.yml`
2. Add `src/pi-gen-image.ts` with `pullPiGenImage()`
3. Add `pi-gen-image` input to `action.yml`
4. Wire into `actions.ts` (before `clonePigen`)

**Phase 2: Seed cache creation**
1. Add `.github/workflows/build-seed-cache.yml`
2. Build + publish seed tarballs as GitHub Release assets
3. Verify contents

**Phase 3: Seed cache consumption + smart skip**
1. Add `src/seed-cache.ts` with `SeedCache` class
2. Add `src/seed-stage-detection.ts` with `detectSkippableStages()`
3. Add `seed-cache` and `seed-stage` inputs
4. Wire into `actions.ts` (after cache restore, before build)
5. Tests for detection logic

**Phase 4: Docs & self-build support**
1. Update README with seed usage instructions
2. Publish reusable workflow for users to build their own seeds
3. Document trust model and verification steps
4. Defaults remain disabled — opt-in only
