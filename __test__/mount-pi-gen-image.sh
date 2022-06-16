#!/bin/bash -ex

IMAGE=$1
MOUNT_PATH=$2

if [[ -z "$IMAGE" || -z "$MOUNT_PATH" ]]; then
    echo "Usage: $0 <image-file> <mount-path>"
    exit 1
fi

if ! command -v losetup &> /dev/null; then
    echo "losetup not found"
    exit 2
fi

LODEV=$(sudo losetup --show -f -P "$IMAGE") || { echo "Creating loopback device for image failed"; exit 3; }

if [[ ! -e "${LODEV}p1" || ! -e "${LODEV}p2" ]]; then
    echo "Mounted image does not contain two partitions"
    sudo losetup -d "${LODEV}"
    exit 4
fi

sudo mkdir -p "${MOUNT_PATH}/boot"
sudo mkdir -p "${MOUNT_PATH}/root"
sudo mount "${LODEV}p1" "${MOUNT_PATH}/boot"
sudo mount "${LODEV}p2" "${MOUNT_PATH}/root"