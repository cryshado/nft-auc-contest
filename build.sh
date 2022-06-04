#!/bin/bash

MINPUT="./func/main.func"
OUTPUT="./auto/code"

func -PA -o "${OUTPUT}.fif" ${FUNC_STDLIB_PATH} ${MINPUT}
echo -e "\"TonUtil.fif\" include\n$(cat ${OUTPUT}.fif)" > "${OUTPUT}.fif"