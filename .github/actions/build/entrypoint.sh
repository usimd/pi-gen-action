#!/bin/sh

PI_GEN_DIR=$1
CONFIG_FILE=$2
TARGET_STAGE=$3
ENABLE_NOOBS=$4

PI_GEN_STAGES=("stage0" "stage1" "stage2" "stage3" "stage4" "stage5")

FINAL_STAGE_REACHED=0
for stage in ${!PI_GEN_STAGES[@]}; do
  if [[ "$FINAL_STAGE_REACHED" == "1" ]]; then
    echo "Skipping pi-gen ${PI_GEN_STAGES[$stage]}"
    touch ${PI_GEN_DIR}/${PI_GEN_STAGES[$stage]}/SKIP
    touch ${PI_GEN_DIR}/${PI_GEN_STAGES[$stage]}/SKIP_IMAGES
  fi

  if [[ "${PI_GEN_STAGES[$stage]}" == "$TARGET_STAGE" ]]; then
    FINAL_STAGE_REACHED=1
  fi
done

ln -s ${TARGET_STAGE} ${PI_GEN_DIR}

${PI_GEN_DIR}/build.sh -c $CONFIG_FILE
