// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { CustomToken, CustomTokenType, NftCollection, NftItem } from '@subwallet/extension-base/background/KoniTypes';
import { getRandomIpfsGateway } from '@subwallet/extension-koni-base/api/nft/config';
import { BaseNftApi, HandleNftParams } from '@subwallet/extension-koni-base/api/nft/nft';
import { ERC721Contract } from '@subwallet/extension-koni-base/api/tokens/evm/web3';
import { isUrl } from '@subwallet/extension-koni-base/utils';
import fetch from 'cross-fetch';
import Web3 from 'web3';

import { isEthereumAddress } from '@polkadot/util-crypto';

export class EvmNftApi extends BaseNftApi {
  evmContracts: CustomToken[] = [];

  constructor (web3: Web3 | null, addresses: string[], chain: string) {
    super(chain, undefined, addresses);

    this.web3 = web3;
    this.isEthereum = true;
  }

  setEvmContracts (evmContracts: CustomToken[]) {
    this.evmContracts = evmContracts;
  }

  override parseUrl (input: string): string | undefined {
    if (!input) {
      return undefined;
    }

    if (isUrl(input)) {
      return input;
    }

    if (input.includes('ipfs://')) {
      return getRandomIpfsGateway() + input.split('ipfs://')[1];
    }

    return getRandomIpfsGateway() + input.split('ipfs://ipfs/')[1];
  }

  private parseMetadata (data: Record<string, any>): NftItem {
    const traitList = data.traits ? data.traits as Record<string, any>[] : data.attributes as Record<string, any>[];
    const propertiesMap: Record<string, any> = {};

    if (traitList) {
      traitList.forEach((traitMap) => {
        propertiesMap[traitMap.trait_type as string] = {
          value: traitMap.value as string
          // rarity: traitMap.trait_count / itemTotal
        };
      });
    }

    // extra fields
    if (data.dna) {
      propertiesMap.dna = {
        value: data.dna as string
      };
    }

    // if (data.compiler) {
    //   propertiesMap.compiler = {
    //     value: data.compiler as string
    //   };
    // }

    return {
      name: data.name as string | undefined,
      image: data.image_url ? this.parseUrl(data.image_url as string) : this.parseUrl(data.image as string),
      description: data.description as string | undefined,
      properties: propertiesMap,
      external_url: data.external_url as string | undefined,
      chain: this.chain
    } as NftItem;
  }

  private async getItemsByCollection (smartContract: string, collectionName: string | undefined, nftParams: HandleNftParams) {
    if (!this.web3) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
    const contract = new this.web3.eth.Contract(ERC721Contract, smartContract);
    let ownItem = false;

    let collectionImage: string | undefined;

    await Promise.all(this.addresses.map(async (address) => {
      if (!isEthereumAddress(address)) {
        return;
      }

      const nftIds: string[] = [];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const balance = (await contract.methods.balanceOf(address).call()) as unknown as number;

      if (Number(balance) === 0) {
        // nftParams.updateReady(true);
        nftParams.updateNftIds(this.chain, address, smartContract, nftIds);
        console.log('no balance for ', address, smartContract);

        return;
      }

      console.log('balance for ', balance);

      const itemIndexes: number[] = [];

      for (let i = 0; i < Number(balance); i++) {
        itemIndexes.push(i);
      }

      try {
        await Promise.all(itemIndexes.map(async (i) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
          const tokenId = await contract.methods.tokenOfOwnerByIndex(address, i).call() as number;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
          const tokenURI = await contract.methods.tokenURI(tokenId).call() as string;

          console.log('token Id, tokenURI', tokenId, tokenURI);

          const detailUrl = this.parseUrl(tokenURI);

          const nftId = tokenId.toString();

          nftIds.push(nftId);

          if (detailUrl) {
            try {
              const resp = await fetch(detailUrl);
              const itemDetail = (resp && resp.ok && await resp.json() as Record<string, any>);

              if (!itemDetail) {
                console.warn(resp?.statusText || `Cannot fetch NFT id [${nftId}] from Web3.`);

                return;
              }

              const parsedItem = this.parseMetadata(itemDetail);

              parsedItem.collectionId = smartContract;
              parsedItem.id = nftId;
              parsedItem.owner = address;
              parsedItem.type = CustomTokenType.erc721;

              if (parsedItem) {
                if (parsedItem.image) {
                  collectionImage = parsedItem.image;
                }

                nftParams.updateItem(this.chain, parsedItem, address);
                ownItem = true;
              }
            } catch (e) {
              console.error(`error parsing item for ${this.chain} nft`, e);
            }
          }
        }));
      } catch (e) {
        console.error('evm nft error', e);
      }

      nftParams.updateNftIds(this.chain, address, smartContract, nftIds);
    }));

    if (ownItem) {
      const nftCollection = {
        collectionId: smartContract,
        collectionName,
        image: collectionImage || undefined,
        chain: this.chain
      } as NftCollection;

      nftParams.updateCollection(this.chain, nftCollection);
      // nftParams.updateReady(true);
    }
  }

  async handleNfts (params: HandleNftParams): Promise<void> {
    if (!this.evmContracts || this.evmContracts.length === 0) {
      return;
    }

    await Promise.all(this.evmContracts.map(async ({ contractAddress, name }) => {
      return await this.getItemsByCollection(contractAddress, name, params);
    }));
  }

  public async fetchNfts (params: HandleNftParams): Promise<number> {
    try {
      await this.handleNfts(params);
    } catch (e) {
      return 0;
    }

    return 1;
  }
}
