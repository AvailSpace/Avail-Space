// [object Object]
// SPDX-License-Identifier: Apache-2.0

import { getBalances } from '@polkadot/extension-koni-base/api/rpc_api/index';
import { getStakingInfo } from '@polkadot/extension-koni-base/api/rpc_api/staking_info';
import {getAllNftsByAccount} from "@polkadot/extension-koni-base/api/nft";

jest.setTimeout(5000000000000);

describe('test rpc api', () => {
  test('test rpc api from endpoints', async () => {
    return getBalances([{ paraId: 2000, chainId: 2 }], 'seAJwjS9prpF7BLXK2DoyuYWZcScrtayEN5kwsjsXmXQxrp').then((rs) => {
      console.log(rs);
      expect(rs).not.toBeNaN();
    }).catch((err) => {
      console.log(err);
    });
  });
});

describe('test api get staking', () => {
  test('test api get bonded token from endpoints', async () => {
    const resp = await getAllNftsByAccount('CmNYnM3pStTCKgXq67Cp8rURA6GTfdfseJx7posbg2vJVHQ');
    const collection = resp.nftList[0]
    const item = collection.nftItems
    console.log(item);
    // const allChainsMapping = getAllChainsMapping()
    // const apis = await connectChains(allChainsMapping)
    // return getMultiCurrentBonded( { apis, accountId: '111B8CxcmnWbuDLyGvgUmRezDCK1brRZmvUuQ6SrFdMyc3S' } ).then(rs => {
    //   console.log(rs.length)
    //   expect(rs).not.toBeNaN()
    // }).catch(err => {
    //   console.log(err)
    // })
  });
});
