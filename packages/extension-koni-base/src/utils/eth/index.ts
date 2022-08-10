// Copyright 2019-2022 @subwallet/extension-koni-base authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Web3Transaction } from '@subwallet/extension-base/signers/types';
import BigN from 'bignumber.js';
import BNEther from 'bn.js';
import RLP, { Input } from 'rlp';
import { SignedTransaction } from 'web3-core';

import { hexStripPrefix, numberToHex, u8aToHex } from '@polkadot/util';

const hexToNumberString = (s: string): string => {
  const temp = parseInt(s, 16);

  if (isNaN(temp)) {
    return '0';
  } else {
    return temp.toString();
  }
};

export class Transaction {
  readonly nonce: string;
  readonly gasPrice: string;
  readonly gas: string;
  readonly action: string;
  readonly value: string;
  readonly data: string;
  readonly ethereumChainId: string;
  readonly isSafe: boolean;

  constructor (nonce: string,
    gasPrice: string,
    gas: string,
    action: string,
    value: string,
    data: string,
    ethereumChainId: string) {
    this.nonce = hexToNumberString(nonce);
    this.gasPrice = hexToNumberString(gasPrice);
    this.gas = hexToNumberString(gas);
    this.action = action;
    this.value = hexToNumberString(value);
    this.data = data || '';
    this.ethereumChainId = parseInt(ethereumChainId, 16).toString();
    this.isSafe = true;
  }
}

export const anyNumberToBN = (value?: string | number | BNEther): BigN => {
  if (typeof value === 'string' || typeof value === 'number') {
    return new BigN(value);
  } else if (typeof value === 'undefined') {
    return new BigN(0);
  } else {
    return new BigN(value.toNumber());
  }
};

export const rlpItem = (rlp: string, position: number) => {
  const decodeArr = RLP.decode(rlp);
  const u8a = (decodeArr as Uint8Array[])[position] || [0];

  return u8aToHex(u8a);
};

export const createTransactionFromRLP = (rlp: string): Transaction | null => {
  try {
    const nonce = rlpItem(rlp, 0);
    const gasPrice = rlpItem(rlp, 1);
    const gas = rlpItem(rlp, 2);
    const action = rlpItem(rlp, 3);
    const value = rlpItem(rlp, 4);
    const data = rlpItem(rlp, 5);
    const ethereumChainId = rlpItem(rlp, 6);

    return new Transaction(nonce,
      gasPrice,
      gas,
      action,
      value,
      data,
      ethereumChainId);
  } catch (e) {
    console.log((e as Error).message);

    return null;
  }
};

export const signatureToHex = (sig: SignedTransaction): string => {
  const v = parseInt(sig.v);
  const r = hexStripPrefix(sig.r);
  const s = hexStripPrefix(sig.s);
  const hexR = r.length % 2 === 1 ? `0${r}` : r;
  const hexS = s.length % 2 === 1 ? `0${s}` : s;
  const hexV = hexStripPrefix(numberToHex(v));

  return hexR + hexS + hexV;
};

export const parseTxAndSignature = (tx: Web3Transaction, _signature: `0x${string}`): `0x${string}` => {
  const signature = _signature.slice(2);
  const r = `0x${signature.substring(0, 64)}`;
  const s = `0x${signature.substring(64, 128)}`;
  const v = `0x${signature.substring(128)}`;
  const data: Input = [
    tx.nonce,
    tx.gasPrice,
    tx.gasLimit,
    tx.to,
    tx.value,
    tx.data,
    v,
    r,
    s
  ];
  const encoded = RLP.encode(data);

  return u8aToHex(encoded);
};
