// Copyright 2019-2022 @subwallet/extension-koni-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ResponseTransfer, TransferErrorCode, TransferStep } from '@subwallet/extension-base/background/KoniTypes';
import { getERC20Contract } from '@subwallet/extension-koni-base/api/web3/web3';
import Web3 from 'web3';
import { TransactionConfig, TransactionReceipt } from 'web3-core';

import { BN } from '@polkadot/util';

export async function handleTransfer (
  transactionObject: TransactionConfig,
  changeValue: string,
  networkKey: string,
  privateKey: string,
  web3ApiMap: Record<string, Web3>,
  callback: (data: ResponseTransfer) => void) {
  const web3Api = web3ApiMap[networkKey];
  const signedTransaction = await web3Api.eth.accounts.signTransaction(transactionObject, privateKey);
  const response: ResponseTransfer = {
    step: TransferStep.READY,
    errors: [],
    extrinsicStatus: undefined,
    data: {}
  };

  try {
    if (signedTransaction?.rawTransaction) {
      console.log('Private key transaction:');
      console.log('Raw transaction:', signedTransaction.rawTransaction);
      console.log('r, s, v:', signedTransaction.r, signedTransaction.s, signedTransaction.v);
      console.log('Recovery address:', web3Api.eth.accounts.recoverTransaction(signedTransaction.rawTransaction));
    }

    signedTransaction?.rawTransaction && web3Api.eth.sendSignedTransaction(signedTransaction.rawTransaction)
      .on('transactionHash', function (hash: string) {
        console.log('transactionHash', hash);
        response.step = TransferStep.READY;
        response.extrinsicHash = hash;
        callback(response);
      })
      // .on('confirmation', function (confirmationNumber, receipt) {
      //   console.log('confirmation', confirmationNumber, receipt);
      //   response.step = TransferStep.PROCESSING;
      //   response.data = receipt;
      //   callback(response);
      // })
      .on('receipt', function (receipt: TransactionReceipt) {
        response.step = TransferStep.SUCCESS;
        response.txResult = {
          change: changeValue || '0',
          fee: (receipt.gasUsed * receipt.effectiveGasPrice).toString()
        };
        callback(response);
      }).catch((e) => {
        response.step = TransferStep.ERROR;
        response.errors?.push({
          code: TransferErrorCode.TRANSFER_ERROR,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
          message: e.message
        });
        callback(response);
      });
  } catch (error) {
    response.step = TransferStep.ERROR;
    response.errors?.push({
      code: TransferErrorCode.TRANSFER_ERROR,
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message: error.message
    });
    callback(response);
  }
}

export async function getEVMTransactionObject (
  networkKey: string,
  to: string,
  value: string,
  transferAll: boolean,
  web3ApiMap: Record<string, Web3>
): Promise<[TransactionConfig, string, string]> {
  console.log('run here');
  const web3Api = web3ApiMap[networkKey];
  const gasPrice = await web3Api.eth.getGasPrice();
  const transactionObject = {
    gasPrice: gasPrice,
    to: to
  } as TransactionConfig;
  const gasLimit = await web3Api.eth.estimateGas(transactionObject);

  transactionObject.gas = gasLimit;

  const estimateFee = parseInt(gasPrice) * gasLimit;

  transactionObject.value = transferAll ? new BN(value).add(new BN(estimateFee).neg()) : value;

  return [transactionObject, transactionObject.value.toString(), estimateFee.toString()];
}

export async function makeEVMTransfer (
  networkKey: string,
  to: string,
  privateKey: string,
  value: string,
  transferAll: boolean,
  web3ApiMap: Record<string, Web3>,
  callback: (data: ResponseTransfer) => void): Promise<void> {
  const [transactionObject, changeValue] = await getEVMTransactionObject(networkKey, to, value, transferAll, web3ApiMap);

  await handleTransfer(transactionObject, changeValue, networkKey, privateKey, web3ApiMap, callback);
}

export async function getERC20TransactionObject (
  assetAddress: string,
  networkKey: string,
  from: string,
  to: string,
  value: string,
  transferAll: boolean,
  web3ApiMap: Record<string, Web3>
): Promise<[TransactionConfig, string, string]> {
  const web3Api = web3ApiMap[networkKey];
  const erc20Contract = getERC20Contract(networkKey, assetAddress, web3ApiMap);

  let freeAmount = new BN(0);
  let transferValue = value;

  if (transferAll) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const bal = await erc20Contract.methods.balanceOf(from).call() as string;

    freeAmount = new BN(bal || '0');
    transferValue = freeAmount.toString() || '0';
  }

  function generateTransferData (to: string, transferValue: string): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    return erc20Contract.methods.transfer(to, transferValue).encodeABI() as string;
  }

  const transferData = generateTransferData(to, transferValue);
  const gasPrice = await web3Api.eth.getGasPrice();
  const transactionObject = {
    gasPrice: gasPrice,
    from,
    to: assetAddress,
    data: transferData
  } as TransactionConfig;

  const gasLimit = await web3Api.eth.estimateGas(transactionObject);

  transactionObject.gas = gasLimit;

  const estimateFee = parseInt(gasPrice) * gasLimit;

  if (transferAll) {
    transferValue = new BN(freeAmount).toString();
    transactionObject.data = generateTransferData(to, transferValue);
  }

  return [transactionObject, transferValue, estimateFee.toString()];
}

export async function makeERC20Transfer (
  assetAddress: string,
  networkKey: string,
  from: string,
  to: string,
  privateKey: string,
  value: string,
  transferAll: boolean,
  web3ApiMap: Record<string, Web3>,
  callback: (data: ResponseTransfer) => void) {
  const [transactionObject, changeValue] = await getERC20TransactionObject(assetAddress, networkKey, from, to, value, transferAll, web3ApiMap);

  await handleTransfer(transactionObject, changeValue, networkKey, privateKey, web3ApiMap, callback);
}
