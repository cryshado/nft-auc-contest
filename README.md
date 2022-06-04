# nft-auc-contest

## prerequisites

- `func ^0.2.0` and `Fift` from [TON repo](https://github.com/ton-blockchain/ton)
- `GNU bash ^3.2.57`
- `NodeJS 16` 
- `npm ^8.1.2`

## build smart-contract

1. install `ton-stdlib` globally
```bash
npm install ton-stdlib@1.0.0 -g
```
 
2. set the environment variable 
```bash
export FIFTPATH="path to ton-stdlib/fift"
export FUNC_STDLIB_PATH="path to ton-stdlib/func/stdlib.fc"
```

3. run command
```bash
bash build.sh
```

## run tests

```bash
npm install
npm run test
```
