#!/bin/bash

MINPUT="./func/main.func"
OUTPUT="./auto/code"

echo "building \"${MINPUT}\""

function errvar {
    echo "[ERR] \"FUNC_STDLIB_PATH\" and \"FIFTPATH\" env vars must be set"
    exit
}

[[ -z "${FUNC_STDLIB_PATH}" ]]  && errvar || :
[[ -z "${FIFTPATH}" ]]          && errvar || :

func -PA -o "${OUTPUT}.fif" ${FUNC_STDLIB_PATH} ${MINPUT}
echo -e "\"TonUtil.fif\" include\n$(cat ${OUTPUT}.fif)" > "${OUTPUT}.fif"
echo "\"${OUTPUT}.fif\" include 2 boc+>B \"${OUTPUT}.boc\" B>file" | fift -s
