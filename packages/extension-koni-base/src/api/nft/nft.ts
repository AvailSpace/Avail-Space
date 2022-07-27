// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiProps, NftCollection, NftItem } from '@subwallet/extension-base/background/KoniTypes';
import { getRandomIpfsGateway } from '@subwallet/extension-koni-base/api/nft/config';
import { isUrl } from '@subwallet/extension-koni-base/utils/utils';
import Web3 from 'web3';

export interface HandleNftParams {
  updateItem: (data: NftItem) => void,
  updateCollection: (data: NftCollection) => void,
  updateReady: (ready: boolean) => void,
  updateNftIds: (networkKey: string, collectionId?: string, nftIds?: string[]) => void,
  updateCollectionIds: (networkKey: string, collectionIds?: string[]) => void
}

export abstract class BaseNftApi {
  chain = '';
  dotSamaApi: ApiProps | null = null;
  web3: Web3 | null = null;
  data: NftCollection[] = [];
  total = 0;
  addresses: string[] = [];
  isEthereum = false;

  protected constructor (chain: string, api?: ApiProps | null, addresses?: string[], web3?: Web3) {
    if (api) {
      this.dotSamaApi = api;
    }

    if (addresses) {
      this.addresses = addresses;
    }

    this.chain = chain;

    if (web3) {
      this.web3 = web3;
    }
  }

  async connect () {
    if (!this.dotSamaApi?.isApiConnected) {
      this.dotSamaApi = await this.dotSamaApi?.isReady as ApiProps;
    }
  }

  recoverConnection () {
    if (!this.dotSamaApi?.isApiConnected) {
      this.dotSamaApi?.recoverConnect && this.dotSamaApi.recoverConnect();
    }
  }

  getDotSamaApi () {
    return this.dotSamaApi;
  }

  getChain () {
    return this.chain;
  }

  getTotal () {
    return this.total;
  }

  getData () {
    return this.data;
  }

  setApi (api: ApiProps) {
    this.dotSamaApi = api;
  }

  setChain (chain: string) {
    this.chain = chain;
  }

  setAddresses (addresses: string[]) {
    this.addresses = addresses;
  }

  protected parseTokenId (tokenId: string) {
    if (tokenId.includes(',')) {
      return tokenId.replace(',', '');
    }

    return tokenId;
  }

  parseUrl (input: string): string | undefined {
    if (!input || input.length === 0) {
      return undefined;
    }

    if (isUrl(input)) {
      return input;
    }

    if (!input.includes('ipfs://')) {
      return getRandomIpfsGateway() + input;
    }

    return getRandomIpfsGateway() + input.split('ipfs://ipfs/')[1];
  }

  // Sub-class implements this function to parse data into prop result
  abstract handleNfts(params: HandleNftParams): void;

  abstract fetchNfts(params: HandleNftParams): Promise<number>;
}
