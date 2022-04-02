// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { NetworkMetadataDef } from '@polkadot/extension-base/background/KoniTypes';

import chains from '../util/chains';

function getNetworkMetadataMap (networkMetaDataItems: NetworkMetadataDef[]): Record<string, NetworkMetadataDef> {
  const result: Record<string, NetworkMetadataDef> = {};

  networkMetaDataItems.forEach((item) => {
    result[item.networkKey] = item;
  });

  return result;
}

const initialState = getNetworkMetadataMap(chains);

const networkMetadataSlice = createSlice({
  initialState,
  name: 'networkMetadata',
  reducers: {
    update (state, action: PayloadAction<NetworkMetadataDef[]>) {
      const { payload } = action;

      payload.forEach((item) => {
        state[item.networkKey] = item;
      });
    }
  }
});

export const { update: updateNetworkMetadata } = networkMetadataSlice.actions;
export default networkMetadataSlice.reducer;
